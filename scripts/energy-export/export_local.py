#!/usr/bin/env python3
"""Export non-identifying, local-time energy data from the collector databases.

Three databases hold the home energy record:

    SolarEdge   interval production (15 min, hourly, daily, monthly, yearly)
    Xcel        utility meter intervals (electric 15 min/hourly/daily, gas monthly)
    analysis    weather-normalized daily metrics and event screening

None of that is safe to hand to a reader as-is: `sites` carries the account
holder, street address, postal code and the site's coordinates; `meters` and
`panels` carry account and optimizer serials. This exporter never selects those
fields. It selects a fixed whitelist, joins only on local calendar dates, and
then re-scans its own output for the excluded values before publishing.

Time is handled twice on purpose. The databases store a UTC instant and a
collector-rendered local string in two different formats (`...Z` versus
`... GMT-0700`). The export recomputes local time from UTC with `zoneinfo`,
compares it with the collector's rendering, and aborts on any disagreement, so
a DST bug in a collector cannot quietly become a published timestamp. Every row
then carries both `*_local` (ISO 8601 with offset) and `*_utc`, because local
time alone is ambiguous in the repeated hour when DST ends.

Usage:

    python3 scripts/energy-export/export_local.py
    python3 scripts/energy-export/export_local.py --out /tmp/energy
    python3 scripts/energy-export/export_local.py --check-existing

The default output is `public/data/` in this site. Output is staged
in a temporary directory, verified, and only then swapped into place, so a
failed run leaves the previous good export untouched.

The dataset is pseudonymous, not anonymous. A 15-minute production trace is a
behavioural fingerprint even without an address, and system size plus install
date narrows the population. See the privacy block in `manifest.json`.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

SCHEMA = "kb-energy-export/1"
SITE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = SITE_ROOT / "public" / "data"
FALLBACK_TZ = "America/Denver"

DEFAULT_SOLAREDGE_DB = Path(
    os.environ.get(
        "SOLAREDGE_DB", Path.home() / "gpt/launchAgent/solaredge/solaredge.sqlite3"
    )
)
DEFAULT_XCEL_DB = Path(
    os.environ.get(
        "XCEL_DB", Path.home() / "gpt/launchAgent/xcel/xcel-usage.sqlite3"
    )
)
DEFAULT_ANALYSIS_DB = Path(
    os.environ.get(
        "ANALYSIS_DB", Path.home() / "gpt/launchAgent/analysis/analysis.sqlite3"
    )
)

SOLAR_FILES = {
    "15min": ("solar-production-15min.csv", "production_kw"),
    "hour": ("solar-production-hourly.csv", "production_kw"),
    "month": ("solar-production-monthly.csv", "production_kwh"),
    "year": ("solar-production-yearly.csv", "production_kwh"),
}

GRID_FILES = {
    "15min": "grid-usage-15min.csv",
    "hour": "grid-usage-hourly.csv",
    "day": "grid-usage-daily.csv",
    "month": "grid-usage-monthly.csv",
}

GRID_HEADER = [
    "interval_start_local",
    "interval_start_utc",
    "date_local",
    "fuel",
    "series",
    "generated",
    "unit",
    "value",
]


class ExportError(RuntimeError):
    """A verification or source-integrity failure; nothing is published."""


def connect_ro(path: Path) -> sqlite3.Connection:
    if not path.exists():
        raise ExportError(f"database not found: {path}")
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def as_instant(text: str) -> datetime:
    value = text.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ExportError(f"timestamp has no zone: {text!r}")
    return parsed


def as_local(text: str, tz: ZoneInfo) -> datetime:
    """Parse either collector's local rendering.

    SolarEdge writes ISO 8601 (`2026-11-13T13:15:00-07:00`); Xcel writes
    `2026-11-13 00:00:00 GMT-0700`.
    """
    value = text.strip()
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S GMT%z")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=tz)
    return parsed


def iso_local(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def num(value, digits: int) -> str:
    if value is None:
        return ""
    return f"{float(value):.{digits}f}"


def date_local(dt: datetime) -> str:
    return dt.date().isoformat()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class Table:
    """A CSV being written into the staging directory."""

    def __init__(self, directory: Path, name: str, header: list[str]):
        self.name = name
        self.header = header
        self.path = directory / name
        self.rows = 0
        self.first_local: str | None = None
        self.last_local: str | None = None
        self._handle = self.path.open("w", newline="", encoding="utf-8")
        self._writer = csv.writer(self._handle, lineterminator="\n")
        self._writer.writerow(header)

    def write(self, row: list[str], local_key: str | None) -> None:
        self._writer.writerow(row)
        self.rows += 1
        if local_key:
            if self.first_local is None:
                self.first_local = local_key
            self.last_local = local_key

    def close(self) -> None:
        self._handle.close()

    def manifest_entry(self) -> dict:
        return {
            "name": self.name,
            "rows": self.rows,
            "bytes": self.path.stat().st_size,
            "sha256": sha256(self.path),
            "first_local": self.first_local,
            "last_local": self.last_local,
            "columns": self.header,
        }


class LocalClock:
    """Recomputes local time from UTC and audits the collector's rendering."""

    def __init__(self, tz: ZoneInfo):
        self.tz = tz
        self.checked = 0
        self.mismatches: list[tuple[str, str, str]] = []

    def localize(self, utc_text: str, stored_local: str) -> datetime:
        instant = as_instant(utc_text)
        expected = instant.astimezone(self.tz)
        self.checked += 1
        actual = as_local(stored_local, self.tz)
        if actual.astimezone(timezone.utc) != instant:
            if len(self.mismatches) < 5:
                self.mismatches.append(
                    (utc_text, stored_local, iso_local(expected))
                )
        return expected


def site_profile(con: sqlite3.Connection) -> dict:
    rows = con.execute(
        """
        select site_id, timezone, peak_power_kw, installation_date,
               inverter_count, battery_count, meter_count
        from sites
        order by site_id
        """
    ).fetchall()
    if len(rows) != 1:
        raise ExportError(
            f"expected exactly one site in the SolarEdge database, found {len(rows)}"
        )
    site_id, tz_name, peak_kwp, installed, inverters, batteries, meters = rows[0]
    panels = con.execute(
        "select count(*) from panels where site_id = ?", (site_id,)
    ).fetchone()[0]
    models = [
        row[0]
        for row in con.execute(
            "select distinct model from panels where site_id = ? and model is not null",
            (site_id,),
        )
    ]
    strings = con.execute(
        "select count(distinct string_name) from panels where site_id = ?", (site_id,)
    ).fetchone()[0]
    return {
        "site_id": site_id,
        "timezone": tz_name or FALLBACK_TZ,
        "peak_power_kwp": peak_kwp,
        "installation_date": installed,
        "panel_count": panels,
        "string_count": strings,
        "panel_models": sorted(models),
        "inverter_count": inverters,
        "battery_count": batteries,
        "meter_count": meters,
    }


def identifier_tokens(
    solar: sqlite3.Connection, xcel: sqlite3.Connection, site_id: int
) -> dict[str, list[str]]:
    """The values that must never appear in an export, by category.

    Categories, not values, are reported on a failed scan: naming a leaked
    value in a log is itself a disclosure.
    """
    tokens: dict[str, set[str]] = {
        "site name": set(),
        "account name": set(),
        "street address": set(),
        "postal code": set(),
        "site identifier": set(),
        "coordinates": set(),
        "account identifier": set(),
        "meter identifier": set(),
        "panel serial": set(),
    }
    row = solar.execute(
        """
        select name, account_name, address, postal_code, latitude, longitude
        from sites where site_id = ?
        """,
        (site_id,),
    ).fetchone()
    if row:
        name, account, address, postal, latitude, longitude = row
        for value, category in (
            (name, "site name"),
            (account, "account name"),
            (address, "street address"),
        ):
            if value and len(value) >= 4:
                tokens[category].add(value)
        # Proper nouns are the durable part of a name or address. House numbers
        # are deliberately excluded: "3007" also occurs as a power reading.
        for word in re.findall(
            r"[A-Za-z]{6,}", " ".join(filter(None, (name, account, address)))
        ):
            tokens["site name"].add(word)
        if postal:
            tokens["postal code"].add(postal)
        for value in (latitude, longitude):
            if value is not None:
                tokens["coordinates"].add(repr(float(value)))
    tokens["site identifier"].add(str(site_id))
    for row in solar.execute("select serial from panels"):
        tokens["panel serial"].add(row[0])
    for row in xcel.execute("select meter_key, account_id from meters"):
        # A one-letter meter key (the gas meter is "G") is a label, not an
        # identifier, and would match half the file.
        if row[0] and len(row[0]) >= 8:
            tokens["meter identifier"].add(row[0])
        if row[1]:
            tokens["account identifier"].add(str(row[1]))
    return {key: sorted(value) for key, value in tokens.items() if value}


def scan_tokens(path: Path, tokens: dict[str, list[str]]) -> list[str]:
    text = path.read_text(encoding="utf-8").lower()
    return [
        category
        for category, values in tokens.items()
        if any(value.lower() in text for value in values)
    ]


def export_solar(
    solar: sqlite3.Connection,
    analysis: sqlite3.Connection | None,
    site_id: int,
    directory: Path,
    clock: LocalClock,
) -> tuple[list[Table], dict]:
    tables: list[Table] = []
    raw_daily: dict[str, float] = {}

    for granularity, (name, measure) in SOLAR_FILES.items():
        header = [
            "interval_start_local",
            "interval_start_utc",
            "date_local",
            measure,
        ]
        if granularity == "month":
            header.insert(3, "month_local")
        table = Table(directory, name, header)
        precision = 4 if measure == "production_kw" else 3
        for utc_text, stored_local, value, _unit in solar.execute(
            """
            select interval_start, interval_start_local, value, unit
            from usage
            where site_id = ? and granularity = ?
            order by interval_start
            """,
            (site_id, granularity),
        ):
            local = clock.localize(utc_text, stored_local)
            row = [iso_local(local), iso_utc(local), date_local(local)]
            if granularity == "month":
                row.append(local.strftime("%Y-%m"))
            row.append(num(value / 1000.0, precision))
            table.write(row, date_local(local))
        table.close()
        tables.append(table)

    for utc_text, stored_local, value in solar.execute(
        """
        select interval_start, interval_start_local, value
        from usage where site_id = ? and granularity = 'day'
        order by interval_start
        """,
        (site_id,),
    ):
        local = clock.localize(utc_text, stored_local)
        raw_daily[date_local(local)] = value

    metrics: dict[str, tuple] = {}
    mismatches = 0
    stale_latest = False
    if analysis is not None:
        for row in analysis.execute(
            """
            select date, yield_kwh_per_kwp, radiation_kwh_m2, performance_index,
                   temp_factor, performance_index_temp_corrected, clear_day,
                   seasonal_baseline, residual, temp_mean_c, precipitation_mm,
                   snowfall_cm, cloud_cover_pct, expected_kwh, production_ratio,
                   production_wh
            from daily_metrics where site_id = ?
            """,
            (site_id,),
        ):
            metrics[row[0]] = row
        # The analysis cache may predate the last collector run, so the current
        # (partial) day is expected to disagree. Publish its raw production but
        # not a residual computed from an older snapshot of the same day.
        latest = max(raw_daily) if raw_daily else None
        for key, row in list(metrics.items()):
            if abs((row[15] or 0.0) - raw_daily.get(key, 0.0)) > 0.5:
                if key == latest:
                    stale_latest = True
                    metrics.pop(key)
                else:
                    mismatches += 1

    daily = Table(
        directory,
        "solar-production-daily.csv",
        [
            "date_local",
            "interval_start_local",
            "interval_start_utc",
            "production_kwh",
            "yield_kwh_per_kwp",
            "radiation_kwh_m2",
            "performance_index",
            "temp_factor",
            "performance_index_corrected",
            "clear_day",
            "seasonal_baseline",
            "residual",
            "temp_mean_c",
            "precipitation_mm",
            "snowfall_cm",
            "cloud_cover_pct",
            "expected_kwh",
            "production_ratio",
        ],
    )
    for utc_text, stored_local, value, _unit in solar.execute(
        """
        select interval_start, interval_start_local, value, unit
        from usage where site_id = ? and granularity = 'day'
        order by interval_start
        """,
        (site_id,),
    ):
        local = clock.localize(utc_text, stored_local)
        key = date_local(local)
        metric = metrics.get(key)
        if metric is None:
            tail = [""] * 14
        else:
            tail = [
                num(metric[1], 4),
                num(metric[2], 3),
                num(metric[3], 5),
                num(metric[4], 4),
                num(metric[5], 5),
                str(int(metric[6])),
                num(metric[7], 5),
                num(metric[8], 5),
                num(metric[9], 1),
                num(metric[10], 2),
                num(metric[11], 2),
                num(metric[12], 0),
                num(metric[13], 3),
                num(metric[14], 4),
            ]
        daily.write(
            [key, iso_local(local), iso_utc(local), num(value / 1000.0, 3)] + tail,
            key,
        )
    daily.close()
    tables.insert(1, daily)

    coverage = {
        "daily_rows": daily.rows,
        "daily_with_analysis": sum(1 for key in raw_daily if key in metrics),
        "analysis_production_mismatches": mismatches,
        "analysis_latest_day_excluded": stale_latest,
        "interval_files_are_sparse": (
            "SolarEdge returns only intervals with production, so a day may hold "
            "far fewer than 96 fifteen-minute or 24 hourly rows."
        ),
        "first_local": daily.first_local,
        "last_local": daily.last_local,
    }
    return tables, coverage


def export_grid(
    xcel: sqlite3.Connection,
    directory: Path,
    clock: LocalClock,
) -> tuple[list[Table], dict[str, dict]]:
    tables: list[Table] = []
    by_date: dict[str, dict] = {}

    for granularity, name in GRID_FILES.items():
        rows = xcel.execute(
            """
            select u.interval_start, u.interval_start_local, u.series,
                   u.generated, u.unit, u.value, m.fuel_type
            from usage u join meters m on m.meter_key = u.meter_key
            where u.granularity = ?
            order by u.interval_start, u.series
            """,
            (granularity,),
        ).fetchall()
        if not rows:
            continue
        table = Table(directory, name, GRID_HEADER)
        for utc_text, stored_local, series, generated, unit, value, fuel in rows:
            local = clock.localize(utc_text, stored_local)
            local_key = date_local(local)
            table.write(
                [
                    iso_local(local),
                    iso_utc(local),
                    local_key,
                    fuel,
                    series,
                    str(int(generated)),
                    unit,
                    num(value, 3),
                ],
                local_key,
            )
            if granularity == "day" and fuel == "E":
                bucket = by_date.setdefault(
                    local_key,
                    {
                        "consumption": 0.0,
                        "export": 0.0,
                        "on_peak": 0.0,
                        "off_peak": 0.0,
                        "on_peak_seen": False,
                        "off_peak_seen": False,
                        "series": 0,
                    },
                )
                bucket["series"] += 1
                if generated:
                    bucket["export"] += -float(value)
                else:
                    bucket["consumption"] += float(value)
                    if "On Peak" in series:
                        bucket["on_peak"] += float(value)
                        bucket["on_peak_seen"] = True
                    elif "Off Peak" in series:
                        bucket["off_peak"] += float(value)
                        bucket["off_peak_seen"] = True
        table.close()
        tables.append(table)

    coverage = {
        "daily_rows": next(
            (table.rows for table in tables if table.name == GRID_FILES["day"]), 0
        ),
        "first_local": next(
            (
                table.first_local
                for table in tables
                if table.name == GRID_FILES["day"]
            ),
            None,
        ),
        "last_local": next(
            (table.last_local for table in tables if table.name == GRID_FILES["day"]),
            None,
        ),
    }
    return tables, {"coverage": coverage, "by_date": by_date}


def export_joined(
    solar: sqlite3.Connection,
    site_id: int,
    grid: dict[str, dict],
    directory: Path,
    clock: LocalClock,
) -> Table:
    production: dict[str, float] = {}
    for utc_text, stored_local, value in solar.execute(
        """
        select interval_start, interval_start_local, value
        from usage where site_id = ? and granularity = 'day'
        order by interval_start
        """,
        (site_id,),
    ):
        local = clock.localize(utc_text, stored_local)
        production[date_local(local)] = float(value) / 1000.0

    table = Table(
        directory,
        "energy-daily-joined.csv",
        [
            "date_local",
            "solar_production_kwh",
            "grid_consumption_kwh",
            "grid_export_kwh",
            "grid_on_peak_kwh",
            "grid_off_peak_kwh",
            "net_grid_kwh",
            "self_consumed_kwh",
            "self_consumption_ratio",
            "grid_series_count",
        ],
    )
    for key in sorted(set(production) | set(grid)):
        produced = production.get(key)
        bucket = grid.get(key)
        if bucket is None:
            consumption = export = on_peak = off_peak = None
            series_count = 0
        else:
            consumption = bucket["consumption"]
            export = bucket["export"]
            on_peak = bucket["on_peak"] if bucket["on_peak_seen"] else None
            off_peak = bucket["off_peak"] if bucket["off_peak_seen"] else None
            series_count = bucket["series"]
        if produced is not None and export is not None:
            self_consumed = produced - export
            ratio = self_consumed / produced if produced else None
        else:
            self_consumed = ratio = None
        net = None if consumption is None else consumption - export
        table.write(
            [
                key,
                num(produced, 3),
                num(consumption, 3),
                num(export, 3),
                num(on_peak, 3),
                num(off_peak, 3),
                num(net, 3),
                num(self_consumed, 3),
                num(ratio, 4),
                str(series_count),
            ],
            key,
        )
    table.close()
    return table


def export_events(
    analysis: sqlite3.Connection, site_id: int, directory: Path
) -> Table:
    table = Table(
        directory,
        "analysis-events.csv",
        [
            "start_date_local",
            "end_date_local",
            "kind",
            "magnitude",
            "residual_before",
            "residual_after",
            "detail",
        ],
    )
    for start, end, kind, magnitude, before, after, detail in analysis.execute(
        """
        select start_date, end_date, kind, magnitude, before_value, after_value, detail
        from events where site_id = ?
        order by start_date, kind
        """,
        (site_id,),
    ):
        table.write(
            [
                start,
                end,
                kind,
                num(magnitude, 4),
                num(before, 4),
                num(after, 4),
                detail or "",
            ],
            start,
        )
    table.close()
    return table


def manifest(
    tz: ZoneInfo,
    profile: dict,
    tables: list[Table],
    coverage: dict,
    consistency: dict,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "schema": SCHEMA,
        "generated_at_utc": iso_utc(now),
        "generated_at_local": iso_local(now.astimezone(tz)),
        "timezone": tz.key,
        "time_policy": {
            "storage": "Source databases store UTC instants plus a collector-rendered local string.",
            "export": "Every instant is emitted twice: local ISO 8601 with offset, and UTC with Z.",
            "local_date": "Calendar date in the site time zone; DST-aware.",
            "verification": "Local time is recomputed from UTC and compared with the collector rendering before publication.",
            "dst_note": "On the autumn transition the local hour repeats; use *_utc to disambiguate duplicate local timestamps.",
        },
        "privacy": {
            "applies_to": "data",
            "basis": "ANONYMIZATION_REQUIRED",
            "method": [
                "fixed field whitelist; source rows are never copied wholesale",
                "site, account, street address, postal code, coordinates, meter key, account id and panel serials are not selected",
                "joins use local calendar date and time only",
                "the staged output is re-scanned for the excluded values before it is swapped into place",
            ],
            "excluded_categories": [
                "site name",
                "account holder and account name",
                "street address and postal code",
                "precise latitude/longitude",
                "site id, account id and meter key",
                "panel and optimizer serials",
            ],
            "residual_risk": [
                "The interval trace is a behavioural fingerprint even without an address: treat it as pseudonymous, not anonymous.",
                "Installation date, system size, panel model and time zone narrow the population and are retained because the analysis needs them.",
                "Weather columns are gridded reanalysis for the site's coordinates, not on-site sensor readings.",
            ],
        },
        "system": {
            "peak_power_kwp": profile["peak_power_kwp"],
            "installation_date_local": (profile["installation_date"] or "")[:10],
            "panel_count": profile["panel_count"],
            "string_count": profile["string_count"],
            "panel_models": profile["panel_models"],
            "inverter_count": profile["inverter_count"],
            "battery_count": profile["battery_count"],
            "meter_count": profile["meter_count"],
        },
        "coverage": coverage,
        "consistency": consistency,
        "files": [table.manifest_entry() for table in tables],
    }


def verify_time_columns(path: Path) -> int:
    """Every exported local timestamp must denote the same instant as its UTC pair."""
    checked = 0
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or "interval_start_local" not in reader.fieldnames:
            return 0
        for row in reader:
            local = as_instant(row["interval_start_local"])
            utc = as_instant(row["interval_start_utc"])
            if local.astimezone(timezone.utc) != utc:
                raise ExportError(
                    f"{path.name}: local and UTC columns disagree on the same row"
                )
            checked += 1
    return checked


def verify(directory: Path, tokens: dict[str, list[str]], clock: LocalClock) -> None:
    if clock.mismatches:
        sample = "; ".join(
            f"{utc} stored as {stored} (UTC implies {expected})"
            for utc, stored, expected in clock.mismatches
        )
        raise ExportError(
            f"local-time verification failed on {len(clock.mismatches)} sampled rows: {sample}"
        )
    leaks: list[str] = []
    for path in sorted(directory.glob("*.csv")):
        verify_time_columns(path)
        hits = scan_tokens(path, tokens)
        if hits:
            leaks.append(f"{path.name}: {', '.join(hits)}")
    if leaks:
        raise ExportError("identifier scan failed: " + "; ".join(leaks))


def check_existing(out: Path, tokens: dict[str, list[str]]) -> int:
    if not out.exists():
        print(f"no export at {out}", file=sys.stderr)
        return 2
    leaks: list[str] = []
    for path in sorted(out.glob("*.csv")):
        hits = scan_tokens(path, tokens)
        if hits:
            leaks.append(f"{path.name}: {', '.join(hits)}")
    if leaks:
        print("identifier scan failed: " + "; ".join(leaks), file=sys.stderr)
        return 1
    print(f"identifier scan clean: {len(list(out.glob('*.csv')))} files")
    return 0


def build(args: argparse.Namespace) -> int:
    solar = connect_ro(args.solaredge_db)
    xcel = connect_ro(args.xcel_db)
    analysis = connect_ro(args.analysis_db) if args.analysis_db.exists() else None

    profile = site_profile(solar)
    tz_name = profile["timezone"]
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError as error:
        raise ExportError(f"unknown time zone: {tz_name}") from error

    tokens = identifier_tokens(solar, xcel, profile["site_id"])
    clock = LocalClock(tz)

    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".energy-export-", dir=str(out.parent)))
    try:
        solar_tables, solar_coverage = export_solar(
            solar, analysis, profile["site_id"], staging, clock
        )
        grid_tables, grid_report = export_grid(xcel, staging, clock)
        joined = export_joined(
            solar, profile["site_id"], grid_report["by_date"], staging, clock
        )
        tables = solar_tables + grid_tables + [joined]
        if analysis is not None:
            tables.append(export_events(analysis, profile["site_id"], staging))

        consistency = {
            "local_time_rows_checked": clock.checked,
            "local_time_mismatches": len(clock.mismatches),
            "analysis_production_mismatches": solar_coverage[
                "analysis_production_mismatches"
            ],
            "analysis_latest_day_excluded": solar_coverage[
                "analysis_latest_day_excluded"
            ],
        }
        coverage = {
            "solar_production": solar_coverage,
            "grid_usage": grid_report["coverage"],
            "joined_days": joined.rows,
        }
        document = manifest(tz, profile, tables, coverage, consistency)
        (staging / "manifest.json").write_text(
            json.dumps(document, indent=2, sort_keys=False) + "\n", encoding="utf-8"
        )

        verify(staging, tokens, clock)

        if out.exists():
            shutil.rmtree(out)
        staging.replace(out)

        print(f"exported {len(tables) + 1} files to {out}")
        for table in tables:
            print(f"  {table.name:<32} {table.rows:>7} rows")
        print(
            f"  time zone {tz.key}; {clock.checked} local timestamps verified; "
            f"{sum(1 for value in tokens.values())} identifier classes scanned"
        )
        return 0
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--solaredge-db", type=Path, default=DEFAULT_SOLAREDGE_DB)
    parser.add_argument("--xcel-db", type=Path, default=DEFAULT_XCEL_DB)
    parser.add_argument("--analysis-db", type=Path, default=DEFAULT_ANALYSIS_DB)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--check-existing",
        action="store_true",
        help="only re-scan an existing export for identifier leaks",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        if args.check_existing:
            solar = connect_ro(args.solaredge_db)
            xcel = connect_ro(args.xcel_db)
            profile = site_profile(solar)
            tokens = identifier_tokens(solar, xcel, profile["site_id"])
            return check_existing(args.out, tokens)
        return build(args)
    except ExportError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    except sqlite3.Error as error:
        print(f"database error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

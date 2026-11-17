#!/usr/bin/env python3
"""
Collect one CyberPower UPS's line voltage and transfer events over SNMP.

Why SNMP and not USB HID: the unit in the lab is an OR1500LCDRT2U with an
RMCARD205 network card. It answers SNMP v1 read requests on the LAN, and the
card exposes the CPS-MIB input/output/battery groups. It is not wired to the
host over USB, and `nutdrv_qx` would need it to be. See README.md.

The store is the same shape the other collectors use: an instant is written
twice, UTC and local time with its offset, so a reader never has to guess
which clock a row is on, and the repeated hour survives.

No serial number, no account, no address is read or stored. The data is
measurement, not identification.

  ./collect_ups.py --once                 one poll, write it, exit
  ./collect_ups.py --loop --interval 60   poll until killed (launchd does this)
  ./collect_ups.py --once --dry-run       print the reading, write nothing
  ./collect_ups.py --status               last sample, open events
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import socket
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

# America/Denver is the record's clock, the same one le.gume-energy publishes.
# Set after _load_env() so collector.env can override it.


def _load_env(path: Path | None = None) -> None:
    """Read collector.env beside this script, without overriding the caller.

    launchd starts with a bare environment, so the machine-local host and store
    path have to come from the file rather than a shell profile. Values already
    in the environment win, which keeps `UPS_HOST=... ./collect_ups.py` working.
    """
    path = path or Path(__file__).with_name("collector.env")
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        value = value.replace("$HOME", str(Path.home()))
        os.environ.setdefault(key.strip(), value)


_load_env()

TZ = ZoneInfo(os.environ.get("UPS_TZ", "America/Denver"))

DEFAULT_HOST = os.environ.get("UPS_HOST", "")
DEFAULT_COMMUNITY = os.environ.get("UPS_COMMUNITY", "public")
DEFAULT_PORT = int(os.environ.get("UPS_PORT", "161"))
DEFAULT_TIMEOUT = float(os.environ.get("UPS_TIMEOUT", "3"))
DEFAULT_INTERVAL = int(os.environ.get("UPS_INTERVAL", "60"))
DEFAULT_DB = os.environ.get(
    "UPS_DB", str(Path.home() / "gpt" / "launchAgent" / "ups" / "ups.sqlite3")
)

SCHEMA = "ups-readings/1"

# --- CPS-MIB (and RFC 1628 where the card implements it) -------------------
# Scaling is exactly the MIB's: 0.1 V, 0.1 Hz, 0.1 A, hundredths of a second.
NUMERIC = [
    # series, oid, divisor, unit
    ("input_voltage", ".1.3.6.1.4.1.3808.1.1.1.3.2.1.0", 10, "V"),
    ("input_voltage_max_1m", ".1.3.6.1.4.1.3808.1.1.1.3.2.2.0", 10, "V"),
    ("input_voltage_min_1m", ".1.3.6.1.4.1.3808.1.1.1.3.2.3.0", 10, "V"),
    ("input_frequency", ".1.3.6.1.4.1.3808.1.1.1.3.2.4.0", 10, "Hz"),
    ("output_voltage", ".1.3.6.1.4.1.3808.1.1.1.4.2.1.0", 10, "V"),
    ("output_frequency", ".1.3.6.1.4.1.3808.1.1.1.4.2.2.0", 10, "Hz"),
    ("output_load", ".1.3.6.1.4.1.3808.1.1.1.4.2.3.0", 1, "%"),
    ("output_current", ".1.3.6.1.4.1.3808.1.1.1.4.2.4.0", 10, "A"),
    ("output_power", ".1.3.6.1.4.1.3808.1.1.1.4.2.5.0", 1, "W"),
    ("battery_capacity", ".1.3.6.1.4.1.3808.1.1.1.2.2.1.0", 1, "%"),
    ("battery_runtime", ".1.3.6.1.4.1.3808.1.1.1.2.2.4.0", 100, "s"),
    ("battery_temperature", ".1.3.6.1.4.1.3808.1.1.1.2.2.3.0", 1, "C"),
    ("battery_voltage", ".1.3.6.1.4.1.3808.1.1.1.2.2.2.0", 10, "V"),
    ("battery_seconds_on_battery", ".1.3.6.1.2.1.33.1.2.2.0", 1, "s"),
    ("agent_uptime", ".1.3.6.1.2.1.1.3.0", 100, "s"),
]

# The enums the record reasons about. Anything not listed is kept as its raw
# integer with no label, so an unknown value is visible rather than guessed.
ENUMS = [
    ("output_source", ".1.3.6.1.4.1.3808.1.1.1.4.1.1.0", {
        1: "unknown", 2: "online", 3: "battery", 4: "boost", 5: "sleep",
        6: "off", 7: "rebooting", 8: "eco", 9: "bypass", 10: "buck",
        11: "overload",
    }),
    ("input_status", ".1.3.6.1.4.1.3808.1.1.1.3.2.6.0", {
        1: "normal", 2: "over_voltage", 3: "under_voltage",
        4: "frequency_failure", 5: "blackout",
    }),
    ("input_fail_cause", ".1.3.6.1.4.1.3808.1.1.1.3.2.5.0", {
        1: "no_transfer", 2: "high_line_voltage", 3: "brownout",
        4: "self_test",
    }),
    ("battery_status", ".1.3.6.1.4.1.3808.1.1.1.2.1.1.0", {
        1: "unknown", 2: "normal", 3: "low", 4: "not_present",
    }),
    ("battery_replace", ".1.3.6.1.4.1.3808.1.1.1.2.2.5.0", {
        1: "no", 2: "needed",
    }),
]

IDENTITY = [
    ("manufacturer", ".1.3.6.1.2.1.33.1.1.1.0"),
    ("model", ".1.3.6.1.4.1.3808.1.1.1.1.1.1.0"),
    ("ups_firmware", ".1.3.6.1.4.1.3808.1.1.1.1.2.3.0"),
    ("agent_firmware", ".1.3.6.1.4.1.3808.1.1.1.1.2.4.0"),
]

# `battery` is the only true transfer to the inverter. `boost`/`buck` are the
# AVR compensating a sag or swell without a transfer — a separate event class,
# because a brownout the AVR absorbs is exactly the case this ticket is about.
TRANSFER_STATES = {"battery"}
AVR_STATES = {"boost", "buck"}


# --- SNMP v1 GET -----------------------------------------------------------
# A hand-rolled GET keeps the collector to the standard library. net-snmp is
# not guaranteed to exist on a host that only needs to read one scalar group.


def _encode_length(n: int) -> bytes:
    if n < 0x80:
        return bytes([n])
    body = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(body)]) + body


def _tlv(tag: int, body: bytes) -> bytes:
    return bytes([tag]) + _encode_length(len(body)) + body


def _encode_integer(value: int) -> bytes:
    size = max(1, (value.bit_length() + 8) // 8)
    return _tlv(0x02, value.to_bytes(size, "big", signed=True))


def _encode_oid(oid: str) -> bytes:
    parts = [int(part) for part in oid.strip(".").split(".")]
    body = bytes([parts[0] * 40 + parts[1]])
    for part in parts[2:]:
        if part < 0x80:
            body += bytes([part])
            continue
        chunks = []
        while part:
            chunks.append(part & 0x7F)
            part >>= 7
        for index, chunk in enumerate(reversed(chunks)):
            body += bytes([chunk | (0x80 if index < len(chunks) - 1 else 0)])
    return _tlv(0x06, body)


def _read_tlv(data: bytes, offset: int):
    tag = data[offset]
    length = data[offset + 1]
    offset += 2
    if length & 0x80:
        count = length & 0x7F
        length = int.from_bytes(data[offset:offset + count], "big")
        offset += count
    return tag, data[offset:offset + length], offset + length


def _decode_value(tag: int, body: bytes):
    if tag == 0x02:
        return int.from_bytes(body, "big", signed=True)
    if tag in (0x41, 0x42, 0x43, 0x46):  # Counter32, Gauge32, TimeTicks, Counter64
        return int.from_bytes(body, "big")
    if tag == 0x04:
        try:
            return body.decode("utf-8")
        except UnicodeDecodeError:
            return body.hex()
    if tag == 0x05:
        return None
    if tag == 0x06:
        return ".".join(str(part) for part in body)  # display only
    return body.hex()


def snmp_get(host: str, community: str, oid: str, *, port: int = DEFAULT_PORT,
             timeout: float = DEFAULT_TIMEOUT, retries: int = 1):
    """One SNMPv1 GET. Returns None for a null/absent scalar."""
    varbind = _tlv(0x30, _encode_oid(oid) + _tlv(0x05, b""))
    pdu = _tlv(
        0xA0,
        _encode_integer(int(time.time() * 1000) & 0x7FFFFFFF)
        + _encode_integer(0)
        + _encode_integer(0)
        + _tlv(0x30, varbind),
    )
    message = _tlv(0x30, _encode_integer(0) + _tlv(0x04, community.encode()) + pdu)

    last_error = None
    for _ in range(retries + 1):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        try:
            sock.sendto(message, (host, port))
            payload, _ = sock.recvfrom(4096)
        except OSError as error:  # timeout, unreachable
            last_error = error
            continue
        finally:
            sock.close()

        _, envelope, _ = _read_tlv(payload, 0)
        cursor = 0
        _, _, cursor = _read_tlv(envelope, cursor)          # version
        _, _, cursor = _read_tlv(envelope, cursor)          # community
        _, response, cursor = _read_tlv(envelope, cursor)   # GetResponse
        cursor = 0
        _, _, cursor = _read_tlv(response, cursor)          # request-id
        _, error_status, cursor = _read_tlv(response, cursor)
        _, _, cursor = _read_tlv(response, cursor)          # error-index
        _, varbind_list, _ = _read_tlv(response, cursor)

        code = int.from_bytes(error_status, "big", signed=True)
        # noSuchName/noSuchObject: a scalar this model does not implement. The
        # record says "not measured" rather than inventing a zero.
        if code in (2, 128, 129):
            return None
        if code:
            raise RuntimeError(f"{host} returned SNMP error-status {code} for {oid}")

        _, varbind, _ = _read_tlv(varbind_list, 0)
        cursor = 0
        _, _, cursor = _read_tlv(varbind, cursor)           # OID
        tag, body, _ = _read_tlv(varbind, cursor)           # value
        return _decode_value(tag, body)

    raise ConnectionError(f"{host}:{port} did not answer {oid}: {last_error}")


# --- reading ---------------------------------------------------------------


def _label(enum: dict, value) -> str | None:
    if value is None:
        return None
    try:
        return enum.get(int(value), f"unknown({value})")
    except (TypeError, ValueError):
        return f"unknown({value})"


def read_device(host: str, community: str, *, port: int = DEFAULT_PORT,
                timeout: float = DEFAULT_TIMEOUT) -> dict:
    """Read the metrics the record needs. Raises if the card is unreachable."""
    reading = {"samples": [], "states": {}, "identity": {}}

    for series, oid, divisor, unit in NUMERIC:
        raw = snmp_get(host, community, oid, port=port, timeout=timeout)
        if raw is None:
            continue
        try:
            value = round(int(raw) / divisor, 1)
        except (TypeError, ValueError):
            continue
        reading["samples"].append({"series": series, "value": value, "unit": unit})

    for name, oid, enum in ENUMS:
        raw = snmp_get(host, community, oid, port=port, timeout=timeout)
        if raw is None:
            continue
        state = _label(enum, raw)
        reading["states"][name] = state
        reading["samples"].append({
            "series": name, "value": raw, "unit": "enum", "label": state,
        })

    for name, oid in IDENTITY:
        raw = snmp_get(host, community, oid, port=port, timeout=timeout)
        if raw:
            reading["identity"][name] = str(raw)

    return reading


# --- store -----------------------------------------------------------------


def connect(db_path: str) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS schema_meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS device (
            device_id      INTEGER PRIMARY KEY CHECK (device_id = 1),
            manufacturer   TEXT,
            model          TEXT,
            ups_firmware   TEXT,
            agent_firmware TEXT,
            first_seen_at  TEXT NOT NULL,
            last_seen_at   TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS runs (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at    TEXT NOT NULL,
            started_at_local TEXT NOT NULL,
            finished_at   TEXT,
            status        TEXT NOT NULL,
            host          TEXT NOT NULL,
            samples       INTEGER NOT NULL DEFAULT 0,
            events_opened INTEGER NOT NULL DEFAULT 0,
            events_closed INTEGER NOT NULL DEFAULT 0,
            error         TEXT
        );
        CREATE TABLE IF NOT EXISTS samples (
            run_id          INTEGER NOT NULL,
            sampled_at      TEXT NOT NULL,
            sampled_at_local TEXT NOT NULL,
            series          TEXT NOT NULL,
            value           REAL,
            unit            TEXT,
            label           TEXT,
            PRIMARY KEY (sampled_at, series),
            FOREIGN KEY (run_id) REFERENCES runs(id)
        );
        CREATE INDEX IF NOT EXISTS samples_series_time
            ON samples (series, sampled_at);
        CREATE TABLE IF NOT EXISTS events (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            kind             TEXT NOT NULL,
            cause            TEXT,
            basis            TEXT NOT NULL,
            started_at       TEXT NOT NULL,
            started_at_local TEXT NOT NULL,
            ended_at         TEXT,
            ended_at_local   TEXT,
            opened_run_id    INTEGER,
            closed_run_id    INTEGER,
            evidence         TEXT,
            FOREIGN KEY (opened_run_id) REFERENCES runs(id),
            FOREIGN KEY (closed_run_id) REFERENCES runs(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS events_one_open
            ON events (kind) WHERE ended_at IS NULL;
        """
    )
    conn.execute(
        "INSERT OR IGNORE INTO schema_meta (key, value) VALUES ('schema', ?)", (SCHEMA,)
    )
    conn.commit()
    return conn


def iso(instant: datetime) -> tuple[str, str]:
    """Return (utc, local) ISO 8601 for one instant."""
    return (
        instant.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        instant.astimezone(TZ).isoformat(timespec="seconds"),
    )


def _last_label(conn: sqlite3.Connection, series: str) -> str | None:
    row = conn.execute(
        "SELECT label FROM samples WHERE series = ? AND label IS NOT NULL"
        " ORDER BY sampled_at DESC LIMIT 1",
        (series,),
    ).fetchone()
    return row[0] if row else None


def _open_event(conn: sqlite3.Connection, kind: str):
    return conn.execute(
        "SELECT id, started_at FROM events WHERE kind = ? AND ended_at IS NULL",
        (kind,),
    ).fetchone()


def _event_should_open(states: dict) -> list[str]:
    opened = []
    source = states.get("output_source")
    if source in TRANSFER_STATES:
        opened.append("transfer")
    if source in AVR_STATES:
        opened.append("avr")
    if states.get("input_status") not in (None, "normal"):
        opened.append("input_excursion")
    return opened


def _event_should_close(states: dict) -> list[str]:
    closed = []
    source = states.get("output_source")
    if source is not None and source not in TRANSFER_STATES:
        closed.append("transfer")
    if source is not None and source not in AVR_STATES:
        closed.append("avr")
    if states.get("input_status") == "normal":
        closed.append("input_excursion")
    return closed


def record_reading(conn: sqlite3.Connection, run_id: int, instant: datetime,
                   reading: dict) -> tuple[int, int]:
    """Write one reading and reconcile the open/closed events.

    Returns (opened, closed). A state the collector did not witness change is
    opened with basis='observed' — the event began before we were watching;
    a change it saw happen here is basis='transition'.
    """
    utc, local = iso(instant)
    previous = {
        name: _last_label(conn, name)
        for name in ("output_source", "input_status")
    }
    for sample in reading["samples"]:
        conn.execute(
            "INSERT OR REPLACE INTO samples"
            " (run_id, sampled_at, sampled_at_local, series, value, unit, label)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (run_id, utc, local, sample["series"], sample["value"],
             sample["unit"], sample.get("label")),
        )

    states = reading["states"]
    opened = closed = 0
    for kind in _event_should_close(states):
        row = _open_event(conn, kind)
        if row:
            conn.execute(
                "UPDATE events SET ended_at = ?, ended_at_local = ?, closed_run_id = ?"
                " WHERE id = ?",
                (utc, local, run_id, row[0]),
            )
            closed += 1

    for kind in _event_should_open(states):
        if _open_event(conn, kind):
            continue
        # A change we saw happen is a transition; a state that was already
        # abnormal at the first sample began before we were watching.
        if kind == "input_excursion":
            cause = states.get("input_status")
            basis = "transition" if previous["input_status"] is not None else "observed"
        else:
            cause = states.get("input_fail_cause")
            basis = "transition" if previous["output_source"] is not None else "observed"
        evidence = json.dumps({
            "output_source": states.get("output_source"),
            "input_status": states.get("input_status"),
            "input_fail_cause": states.get("input_fail_cause"),
            "input_voltage": next(
                (s["value"] for s in reading["samples"] if s["series"] == "input_voltage"),
                None,
            ),
        }, sort_keys=True)
        conn.execute(
            "INSERT INTO events (kind, cause, basis, started_at, started_at_local,"
            " opened_run_id, evidence) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (kind, cause, basis, utc, local, run_id, evidence),
        )
        opened += 1

    return opened, closed


def upsert_device(conn: sqlite3.Connection, reading: dict, utc: str) -> None:
    identity = reading.get("identity") or {}
    conn.execute(
        """
        INSERT INTO device (device_id, manufacturer, model, ups_firmware,
                            agent_firmware, first_seen_at, last_seen_at)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (device_id) DO UPDATE SET
            manufacturer   = COALESCE(excluded.manufacturer, device.manufacturer),
            model          = COALESCE(excluded.model, device.model),
            ups_firmware   = COALESCE(excluded.ups_firmware, device.ups_firmware),
            agent_firmware = COALESCE(excluded.agent_firmware, device.agent_firmware),
            last_seen_at   = excluded.last_seen_at
        """,
        (
            identity.get("manufacturer"),
            identity.get("model"),
            identity.get("ups_firmware"),
            identity.get("agent_firmware"),
            utc,
            utc,
        ),
    )


# --- commands --------------------------------------------------------------


def collect_once(conn: sqlite3.Connection, host: str, community: str, *,
                 port: int, timeout: float, dry_run: bool = False) -> dict:
    instant = datetime.now(timezone.utc).replace(microsecond=0)
    utc, local = iso(instant)
    reading = read_device(host, community, port=port, timeout=timeout)

    result = {
        "sampled_at": utc,
        "sampled_at_local": local,
        "states": reading["states"],
        "samples": len(reading["samples"]),
    }
    if dry_run:
        result["identity"] = reading["identity"]
        result["reading"] = reading["samples"]
        return result

    run_id = conn.execute(
        "INSERT INTO runs (started_at, started_at_local, status, host)"
        " VALUES (?, ?, 'running', ?)",
        (utc, local, host),
    ).lastrowid
    upsert_device(conn, reading, utc)
    opened, closed = record_reading(conn, run_id, instant, reading)
    conn.execute(
        "UPDATE runs SET finished_at = ?, status = 'ok', samples = ?,"
        " events_opened = ?, events_closed = ? WHERE id = ?",
        (utc, len(reading["samples"]), opened, closed, run_id),
    )
    conn.commit()
    result.update({"run_id": run_id, "events_opened": opened, "events_closed": closed})
    return result


def status(conn: sqlite3.Connection) -> dict:
    device = conn.execute(
        "SELECT manufacturer, model, ups_firmware, agent_firmware, first_seen_at,"
        " last_seen_at FROM device WHERE device_id = 1"
    ).fetchone()
    last = conn.execute(
        "SELECT sampled_at, sampled_at_local, series, value, unit, label"
        " FROM samples ORDER BY sampled_at DESC LIMIT 12"
    ).fetchall()
    open_events = conn.execute(
        "SELECT id, kind, cause, basis, started_at, started_at_local"
        " FROM events WHERE ended_at IS NULL ORDER BY started_at"
    ).fetchall()
    runs = conn.execute("SELECT COUNT(*) FROM runs").fetchone()[0]
    return {
        "device": dict(zip(
            ["manufacturer", "model", "ups_firmware", "agent_firmware",
             "first_seen_at", "last_seen_at"], device)) if device else None,
        "runs": runs,
        "last_samples": [
            {"at": row[0], "at_local": row[1], "series": row[2], "value": row[3],
             "unit": row[4], "label": row[5]}
            for row in last
        ],
        "open_events": [
            {"id": row[0], "kind": row[1], "cause": row[2], "basis": row[3],
             "started_at": row[4], "started_at_local": row[5]}
            for row in open_events
        ],
    }


def _lock(db_path: str):
    """One collector per store, so two launchd runs cannot interleave events."""
    lock_path = Path(db_path).with_suffix(".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = open(lock_path, "w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        raise SystemExit("another collector holds the lock on " + str(lock_path))
    return handle


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Collect a CyberPower UPS over SNMP.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--community", default=DEFAULT_COMMUNITY)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--once", action="store_true", help="one poll, then exit")
    parser.add_argument("--loop", action="store_true", help="poll until killed")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL)
    parser.add_argument("--dry-run", action="store_true", help="print, write nothing")
    parser.add_argument("--status", action="store_true", help="show the store")
    args = parser.parse_args(argv)

    if args.status:
        conn = connect(args.db)
        print(json.dumps(status(conn), indent=2))
        return 0

    if args.loop and args.dry_run:
        parser.error("--loop and --dry-run are mutually exclusive")

    if not args.host:
        parser.error("set UPS_HOST in collector.env (or pass --host); no address is baked in")

    if not args.loop and not args.once:
        args.once = True

    conn = None if args.dry_run else connect(args.db)
    lock = None if args.dry_run else _lock(args.db)

    try:
        while True:
            try:
                result = collect_once(
                    conn, args.host, args.community, port=args.port,
                    timeout=args.timeout, dry_run=args.dry_run,
                )
            except (ConnectionError, RuntimeError, OSError) as error:
                message = f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} " \
                          f"{args.host}: {error}"
                print(message, file=sys.stderr)
                if not args.loop:
                    return 1
                time.sleep(args.interval)
                continue

            print(json.dumps(result, sort_keys=True))
            if not args.loop:
                return 0
            time.sleep(args.interval)
    finally:
        if conn is not None:
            conn.close()
        if lock is not None:
            lock.close()


if __name__ == "__main__":
    raise SystemExit(main())

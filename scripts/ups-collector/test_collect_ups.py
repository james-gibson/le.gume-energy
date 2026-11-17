"""Tests for the UPS collector's codec and event state machine.

No device is needed: the SNMP layer is exercised on its encoding, and the
store is a temporary database fed synthetic readings.

    python3 -m unittest scripts/ups-collector/test_collect_ups.py
"""

import importlib.util
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("collect_ups", HERE / "collect_ups.py")
collect_ups = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collect_ups)


class BerTest(unittest.TestCase):
    def test_lengths(self):
        self.assertEqual(collect_ups._encode_length(0), b"\x00")
        self.assertEqual(collect_ups._encode_length(127), b"\x7f")
        self.assertEqual(collect_ups._encode_length(128), b"\x81\x80")
        self.assertEqual(collect_ups._encode_length(300), b"\x82\x01\x2c")

    def test_oid_round_trip(self):
        oid = "1.3.6.1.4.1.3808.1.1.1.3.2.1.0"
        encoded = collect_ups._encode_oid(oid)
        tag, body, end = collect_ups._read_tlv(encoded, 0)
        self.assertEqual(tag, 0x06)
        self.assertEqual(end, len(encoded))
        # 1.3 is packed into one subidentifier: 1*40+3.
        self.assertEqual(body[0], 0x2b)
        # The scalar instance ends in .0.
        self.assertEqual(body[-1], 0x00)

    def test_integer_encoding(self):
        for value in (0, 1, 127, 128, 3808, 1210):
            tag, body, _ = collect_ups._read_tlv(collect_ups._encode_integer(value), 0)
            self.assertEqual(tag, 0x02)
            self.assertEqual(int.from_bytes(body, "big", signed=True), value)

    def test_enum_labels_keep_unknown_values_visible(self):
        enum = {1: "normal", 3: "under_voltage"}
        self.assertEqual(collect_ups._label(enum, 3), "under_voltage")
        self.assertEqual(collect_ups._label(enum, 9), "unknown(9)")
        self.assertIsNone(collect_ups._label(enum, None))


class EventTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.tmp.name) / "ups.sqlite3")
        self.conn = collect_ups.connect(self.db)
        self.clock = datetime(2026, 11, 16, 20, 0, tzinfo=timezone.utc)
        self.run_id = self._run()

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def _run(self):
        utc, local = collect_ups.iso(self.clock)
        return self.conn.execute(
            "INSERT INTO runs (device, started_at, started_at_local, status, host)"
            " VALUES ('rack', ?, ?, 'running', 'test')",
            (utc, local),
        ).lastrowid

    def _reading(self, source="online", status="normal", cause="no_transfer"):
        states = {}
        samples = [{"series": "input_voltage", "value": 121.0, "unit": "V"}]
        for name, value in (
            ("output_source", source),
            ("input_status", status),
            ("input_fail_cause", cause),
        ):
            if value is not None:
                states[name] = value
                samples.append(
                    {"series": name, "value": 1, "unit": "enum", "label": value}
                )
        return {"samples": samples, "states": states, "identity": {}}

    def _at(self, seconds):
        return self.clock + timedelta(seconds=seconds)

    def test_quiet_poll_opens_nothing(self):
        opened, closed = collect_ups.record_reading(
            self.conn, "rack", self.run_id, self.clock, self._reading()
        )
        self.assertEqual((opened, closed), (0, 0))

    def test_transfer_and_excursion_open_then_close(self):
        opened, _ = collect_ups.record_reading(
            self.conn, "rack", self.run_id, self.clock,
            self._reading("battery", "under_voltage", "brownout"),
        )
        self.assertEqual(opened, 2)
        kinds = {row[0] for row in self.conn.execute(
            "SELECT kind FROM events WHERE ended_at IS NULL"
        )}
        self.assertEqual(kinds, {"transfer", "input_excursion"})

        _, closed = collect_ups.record_reading(
            self.conn, "rack", self.run_id, self._at(120), self._reading()
        )
        self.assertEqual(closed, 2)
        rows = list(self.conn.execute(
            "SELECT kind, cause, basis, started_at, ended_at FROM events ORDER BY kind"
        ))
        self.assertEqual(len(rows), 2)
        for kind, cause, basis, started_at, ended_at in rows:
            self.assertEqual(started_at, "2026-11-16T20:00:00Z")
            self.assertEqual(ended_at, "2026-11-16T20:02:00Z")
            self.assertEqual(basis, "observed")
        self.assertEqual({row[0] for row in rows}, {"input_excursion", "transfer"})

    def test_avr_is_its_own_event(self):
        opened, _ = collect_ups.record_reading(
            self.conn, "rack", self.run_id, self.clock, self._reading("boost", "under_voltage")
        )
        self.assertEqual(opened, 2)
        kinds = {row[0] for row in self.conn.execute("SELECT kind FROM events")}
        self.assertEqual(kinds, {"avr", "input_excursion"})

    def test_basis_is_transition_when_the_change_was_witnessed(self):
        collect_ups.record_reading(self.conn, "rack", self.run_id, self.clock, self._reading())
        collect_ups.record_reading(
            self.conn, "rack", self.run_id, self._at(60),
            self._reading("battery", "under_voltage", "brownout"),
        )
        rows = dict(self.conn.execute("SELECT kind, basis FROM events"))
        self.assertEqual(rows, {"transfer": "transition", "input_excursion": "transition"})

    def test_one_open_event_per_kind(self):
        collect_ups.record_reading(
            self.conn, "rack", self.run_id, self.clock, self._reading("battery", "under_voltage")
        )
        opened, _ = collect_ups.record_reading(
            self.conn, "rack", self.run_id, self._at(30), self._reading("battery", "under_voltage")
        )
        self.assertEqual(opened, 0)
        count = self.conn.execute(
            "SELECT COUNT(*) FROM events WHERE kind = 'transfer' AND ended_at IS NULL"
        ).fetchone()[0]
        self.assertEqual(count, 1)

    def test_instant_is_written_utc_and_local_with_the_offset(self):
        collect_ups.record_reading(self.conn, "rack", self.run_id, self.clock, self._reading())
        utc, local = self.conn.execute(
            "SELECT sampled_at, sampled_at_local FROM samples"
        ).fetchone()
        self.assertEqual(utc, "2026-11-16T20:00:00Z")
        self.assertEqual(local, "2026-11-16T13:00:00-07:00")


class MultiDeviceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.tmp.name) / "ups.sqlite3")
        self.conn = collect_ups.connect(self.db)
        self.clock = datetime(2026, 11, 16, 20, 0, tzinfo=timezone.utc)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_parse_hosts_labels_and_duplicates(self):
        self.assertEqual(
            collect_ups.parse_hosts("rack=10.0.0.5, desk=10.0.0.6"),
            [("rack", "10.0.0.5"), ("desk", "10.0.0.6")],
        )
        self.assertEqual(
            collect_ups.parse_hosts("10.0.0.5"),
            [("ups", "10.0.0.5")],
        )
        with self.assertRaises(ValueError):
            collect_ups.parse_hosts("rack=10.0.0.5,rack=10.0.0.6")

    def test_unreachable_unit_is_recorded_and_does_not_stop_the_other(self):
        result = collect_ups.collect_once(
            self.conn, "desk", "127.0.0.1", "public", port=9, timeout=0.3
        )
        self.assertFalse(result["ok"])
        status = self.conn.execute(
            "SELECT status FROM runs WHERE device = 'desk'"
        ).fetchone()[0]
        self.assertEqual(status, "unreachable")

        run_id = self.conn.execute(
            "INSERT INTO runs (device, started_at, started_at_local, status, host)"
            " VALUES ('rack', '2026-11-16T20:00:00Z', '2026-11-16T13:00:00-07:00',"
            " 'running', 'test')"
        ).lastrowid
        reading = {
            "samples": [{"series": "input_voltage", "value": 121.0, "unit": "V"}],
            "states": {"output_source": "online", "input_status": "normal"},
            "identity": {},
        }
        opened, closed = collect_ups.record_reading(
            self.conn, "rack", run_id, self.clock, reading
        )
        self.assertEqual((opened, closed), (0, 0))
        self.assertEqual(
            self.conn.execute(
                "SELECT COUNT(*) FROM samples WHERE device = 'rack'"
            ).fetchone()[0],
            1,
        )


class MigrationTest(unittest.TestCase):
    def test_v1_store_migrates_in_place(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = str(Path(tmp) / "v1.sqlite3")
            conn = sqlite3.connect(db)
            conn.executescript(
                """
                CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                INSERT INTO schema_meta VALUES ('schema', 'ups-readings/1');
                CREATE TABLE device (
                    device_id INTEGER PRIMARY KEY CHECK (device_id = 1),
                    manufacturer TEXT, model TEXT, ups_firmware TEXT,
                    agent_firmware TEXT,
                    first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);
                INSERT INTO device VALUES
                    (1, 'CPS', 'OR1500LCDRT2U', '', '1.1.7',
                     '2026-11-16T23:58:19Z', '2026-11-16T23:58:19Z');
                CREATE TABLE runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    started_at TEXT NOT NULL, started_at_local TEXT NOT NULL,
                    finished_at TEXT, status TEXT NOT NULL, host TEXT NOT NULL,
                    samples INTEGER NOT NULL DEFAULT 0,
                    events_opened INTEGER NOT NULL DEFAULT 0,
                    events_closed INTEGER NOT NULL DEFAULT 0, error TEXT);
                INSERT INTO runs VALUES
                    (1, '2026-11-16T23:58:19Z', '2026-11-16T16:58:19-07:00',
                     NULL, 'ok', 'host', 1, 0, 0, NULL);
                CREATE TABLE samples (
                    run_id INTEGER NOT NULL, sampled_at TEXT NOT NULL,
                    sampled_at_local TEXT NOT NULL, series TEXT NOT NULL,
                    value REAL, unit TEXT, label TEXT,
                    PRIMARY KEY (sampled_at, series));
                INSERT INTO samples VALUES
                    (1, '2026-11-16T23:58:19Z', '2026-11-16T16:58:19-07:00',
                     'input_voltage', 121.0, 'V', NULL);
                CREATE TABLE events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL, cause TEXT, basis TEXT NOT NULL,
                    started_at TEXT NOT NULL, started_at_local TEXT NOT NULL,
                    ended_at TEXT, ended_at_local TEXT,
                    opened_run_id INTEGER, closed_run_id INTEGER, evidence TEXT);
                CREATE UNIQUE INDEX events_one_open
                    ON events (kind) WHERE ended_at IS NULL;
                """
            )
            conn.commit()
            conn.close()

            conn = collect_ups.connect(db)
            self.assertEqual(
                conn.execute(
                    "SELECT value FROM schema_meta WHERE key = 'schema'"
                ).fetchone()[0],
                "ups-readings/2",
            )
            self.assertEqual(
                conn.execute("SELECT name FROM device").fetchone()[0], "ups"
            )
            self.assertEqual(
                conn.execute("SELECT device, value FROM samples").fetchone(),
                ("ups", 121.0),
            )
            conn.close()


if __name__ == "__main__":
    unittest.main()

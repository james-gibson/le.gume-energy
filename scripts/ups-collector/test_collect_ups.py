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
            "INSERT INTO runs (started_at, started_at_local, status, host)"
            " VALUES (?, ?, 'running', 'test')",
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
            self.conn, self.run_id, self.clock, self._reading()
        )
        self.assertEqual((opened, closed), (0, 0))

    def test_transfer_and_excursion_open_then_close(self):
        opened, _ = collect_ups.record_reading(
            self.conn, self.run_id, self.clock,
            self._reading("battery", "under_voltage", "brownout"),
        )
        self.assertEqual(opened, 2)
        kinds = {row[0] for row in self.conn.execute(
            "SELECT kind FROM events WHERE ended_at IS NULL"
        )}
        self.assertEqual(kinds, {"transfer", "input_excursion"})

        _, closed = collect_ups.record_reading(
            self.conn, self.run_id, self._at(120), self._reading()
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
            self.conn, self.run_id, self.clock, self._reading("boost", "under_voltage")
        )
        self.assertEqual(opened, 2)
        kinds = {row[0] for row in self.conn.execute("SELECT kind FROM events")}
        self.assertEqual(kinds, {"avr", "input_excursion"})

    def test_basis_is_transition_when_the_change_was_witnessed(self):
        collect_ups.record_reading(self.conn, self.run_id, self.clock, self._reading())
        collect_ups.record_reading(
            self.conn, self.run_id, self._at(60),
            self._reading("battery", "under_voltage", "brownout"),
        )
        rows = dict(self.conn.execute("SELECT kind, basis FROM events"))
        self.assertEqual(rows, {"transfer": "transition", "input_excursion": "transition"})

    def test_one_open_event_per_kind(self):
        collect_ups.record_reading(
            self.conn, self.run_id, self.clock, self._reading("battery", "under_voltage")
        )
        opened, _ = collect_ups.record_reading(
            self.conn, self.run_id, self._at(30), self._reading("battery", "under_voltage")
        )
        self.assertEqual(opened, 0)
        count = self.conn.execute(
            "SELECT COUNT(*) FROM events WHERE kind = 'transfer' AND ended_at IS NULL"
        ).fetchone()[0]
        self.assertEqual(count, 1)

    def test_instant_is_written_utc_and_local_with_the_offset(self):
        collect_ups.record_reading(self.conn, self.run_id, self.clock, self._reading())
        utc, local = self.conn.execute(
            "SELECT sampled_at, sampled_at_local FROM samples"
        ).fetchone()
        self.assertEqual(utc, "2026-11-16T20:00:00Z")
        self.assertEqual(local, "2026-11-16T13:00:00-07:00")


if __name__ == "__main__":
    unittest.main()

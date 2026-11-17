# UPS collector

`collect_ups.py` polls one CyberPower UPS over SNMP and writes line voltage, the
AVR/transfer state and the transfer events to the shared store. Every row carries
the instant twice — UTC and `America/Denver` with its offset — matching the rest
of the record.

## Why SNMP, not USB HID

The ticket that asked for this assumed a USB HID unit read through NUT's
`nutdrv_qx`. That is not the device in the lab:

| Fact | Measured 2026-11-16 |
| --- | --- |
| Unit | CPS `OR1500LCDRT2U`, 1500 VA / 900 W |
| Card | `RMCARD205`, agent firmware `1.1.7` |
| Path | network, SNMP v1 read (address in `collector.env`, community `public`) |
| USB | not connected to this host |

The card's LAN address is machine-local and gitignored; no address, serial or
account is baked into the script, the README or the store.

A full SNMP sweep of the segment on 2026-11-16 found **one** card answering with
`sysDescr = "UPS SNMP Card"`, and one CyberPower MAC on the wire. The second
unit was not reachable at that time, so it is left out of `UPS_HOSTS` until its
address is known; adding it later does not disturb the first unit's history.

So the driver is a plain SNMP poller. It reads the card's CPS-MIB group
(`1.3.6.1.4.1.3808.1.1.1`) and the RFC 1628 battery group
(`1.3.6.1.2.1.33.1`), and needs no `net-snmp` binary or `pysnmp` — the GET is
encoded in the script.

The card's firmware predates the REST API (added in RMCARD firmware 1.4.4), so
`/api/upsstatus/` and `/api/upsevent/` are not available here.

## What SNMP does **not** give you

SNMP exposes the present, not the past:

- `upsAdvanceInputMinLineVoltage` / `MaxLineVoltage` are the min and max over the
  **previous minute** only.
- `upsAdvanceInputLineFailCause` is the cause of the *current* transfer, and
  reads `noTransfer` in utility mode.
- `upsBaseBatteryTimeOnBattery` is the time on battery for the current transfer.

The device's history — the Event Log and the Status Records (input min/max per
recorded interval) — lives in the card's web/CLI interface and needs the
administrator login. That is the only way to time-anchor an event that has
already finished. The collector is what makes the *next* one measurable.

## Store

Default `~/gpt/launchAgent/ups/ups.sqlite3`, beside the other collectors. One
file holds every unit; the unit is a **label**, and the address can move without
the record losing the unit.

```sql
device(name, host, manufacturer, model, ups_firmware, agent_firmware, first_seen_at, last_seen_at)
runs(id, device, started_at, started_at_local, finished_at, status, host, samples, ...)
samples(device, run_id, sampled_at, sampled_at_local, series, value, unit, label)
events(id, device, kind, cause, basis, started_at, started_at_local, ended_at, ended_at_local, evidence)
```

`series` are the CPS-MIB scalars: `input_voltage`, `input_voltage_min_1m`,
`input_voltage_max_1m`, `input_frequency`, `output_voltage`, `output_frequency`,
`output_load`, `output_current`, `output_power`, `battery_capacity`,
`battery_runtime`, `battery_temperature`, `battery_voltage`,
`battery_seconds_on_battery`, `agent_uptime`, and the enums `output_source`,
`input_status`, `input_fail_cause`, `battery_status`, `battery_replace`.

Three event classes, because they are different physical things:

| `kind` | Opens when | Meaning |
| --- | --- | --- |
| `transfer` | `output_source = battery` | the load is on the inverter |
| `avr` | `output_source = boost/buck` | the AVR is compensating a sag/swell, no transfer |
| `input_excursion` | `input_status != normal` | the card itself says the line is out of range |

A partial unique index allows at most one open event of each kind **per unit**.
An event the collector did not see begin is opened with `basis = observed` (it
was already in progress at the first sample); one it saw change is `transition`.

**No serial number, account or address is read or stored.** The store is
measurement, not identification. Nothing here is published yet; a public series
would need its own privacy record and a manifest entry, like every other CSV.

## Two units, and one that may be unreachable

The lab has more than one power unit. `UPS_HOSTS` takes `label=host` entries:

```bash
UPS_HOSTS="rack=192.168.1.10,spare=192.168.1.11"
```

A unit that does not answer is **not** a reason to stop, and not a reason to
delete it: the run is recorded with `status = unreachable` and the error, and
the other units are still polled. A unit that answers badly — an unparseable
response or a device error-status — is `status = error`: the unit is there, the
answer is not usable, and the difference matters when triaging.

`--once` exits 0 if at least one unit was read, and 1 only if every unit failed
— the store, not the exit code, is the record of which unit was missing.

A store whose schema version is **newer** than the collector is refused before
any write. The collector does not downgrade the marker and does not touch the
tables; the failure is a human decision, not a silent migration.

The label is the identity. If a card is re-addressed, change the address beside
the same label and its history continues; if you rename the label, you start a
new unit. A unit that is simply powered off will show a growing run of
`unreachable` rows, which is the honest state of a unit you cannot measure.

## Run

```bash
cp collector.env.example collector.env && chmod 600 collector.env
./collect_ups.py --once --dry-run     # print each reading, write nothing
./collect_ups.py --once              # one poll of every configured unit
./collect_ups.py --status            # every unit, its last samples and open events
./collect_ups.py --loop --interval 60
```

A single unit can also be named directly: `--host <addr> --device rack`.
`--dry-run` needs no database. `--loop` holds an exclusive lock on
`ups.sqlite3.lock`, so two schedules cannot interleave event open/close.

## Schedule

```bash
./install.sh            # launchd agent, StartInterval 60
./install.sh status
./install.sh run
./install.sh uninstall
```

The agent runs every 60 seconds with `RunAtLoad`. It does not need the login
PATH; the plist calls the system `python3` directly.

## Tests

```bash
python3 -m unittest scripts/ups-collector/test_collect_ups.py
```

The tests cover the BER codec, the event state machine, the v1→v2 store
migration and the unreachable-unit path, all against temporary stores; no
device is needed.

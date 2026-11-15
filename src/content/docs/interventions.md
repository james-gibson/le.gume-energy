---
title: Declared interventions
description: A dated action against a circuit — what the record cannot see on its own, and how the charts and keyframes learn about it.
order: 9
updated: 2026-11-15
tags: interventions, circuits, keyframes, method
seeds: homeowner, agent-operations
---

# Declared interventions

The record sees weather, production and the utility. It does not see a person: it cannot know that
the garage freezer was unplugged at 14:32, that the panels were switched off for twenty minutes, or
that a parasitic draw was removed from the office. Those are **interventions**, and they have to be
declared.

## The record

`src/data/interventions.json` — authored, not exported. Append with the command; do not hand-edit
ids, because the charts, the universe and the guard all key off them.

```json
{
  "id": "2026-09-20-garage-measure",
  "at": "2026-09-20T10:00:00-06:00",
  "at_utc": "2026-09-20T16:00:00Z",
  "circuit": "garage",
  "action": "measure",
  "kind": "ac",
  "load": "chest freezer standby",
  "minutes": 30,
  "measured": { "volts": 120.4, "amps": 0.42, "pf": 0.92, "source": "clamp meter, panel A" }
}
```

An instant is stored twice: local with its offset, and UTC. Local time is mandatory and an offset is
mandatory — on the autumn transition an hour happens twice, and a bare `14:32` names both of them.

## The command

```bash
npm run intervention -- add --circuit garage --action unplug \
  --load "chest freezer" --minutes 90 \
  --volts 120.1 --amps 1.35 --pf 0.92 --source "clamp meter, panel A"

npm run intervention -- list      # what is recorded, with the derived power
```

| flag | meaning |
| --- | --- |
| `--circuit` | the circuit or location: `garage`, `kitchen`, `panels`, `lighting`, `hvac`, `standby` |
| `--action` | `unplug`, `remove-standby`, `panels-off`, `panels-on`, `lights-off`, `lights-on`, `breaker-off`, `breaker-on`, `load-on`, `measure` |
| `--at` | local ISO with offset; defaults to now on this machine |
| `--volts` `--amps` | what the meter showed |
| `--pf` | power factor, AC only |
| `--kind` | `ac` (default) or `dc` |
| `--minutes` | how long the condition held, for the energy conversion |
| `--load` `--note` `--verify` `--source` | free text; `--source` says how it was measured |

## The arithmetic, stated rather than assumed

```
apparent power   VA = volts × amps                 always computable
real power       W  = VA × pf                      AC, when a power factor was reported
                 W  = VA                            DC, where pf is 1 by definition
energy           Wh = W × minutes / 60
```

A missing power factor on AC leaves **W and Wh empty**, not zero and not `VA × 1.0`. A clamp meter
reads amps; the power factor is a property of the load, and inventing it would turn a measurement
into a guess. The table prints `—` where the record does not know.

## What the charts do with it

- **The last sixty days** gains a marker: a solid rule at the day and a dot at the top, distinct from
  the shaded band of a *detected* event (snow, offline, recovery).
- **Declared interventions** is a table: when, which circuit, what action, measured VA/W/Wh, and the
  seven days either side in mean production and weather-normalized residual.
- **The local-time universe** gains a keyframe per intervention, at `MINUTE` precision rather than the
  `DAY` precision of an exported event, with tags `intervention`, the circuit and the action. A
  declared instant can land past the last exported day, and the epoch extends to contain it.

## What this cannot prove

The seven-day fence is a fence, not a proof. The weather inside it is not the weather outside it, the
house's other loads do not hold still, and two actions in the same week cannot be separated. The
residual column is the only one comparable across seasons, and it normalizes for the sun only.

So use it to ask whether a level held or stepped when nothing else did — and declare one action at a
time, with the meter reading that came with it.

## Privacy

Circuit names and load names are the homeowner's to choose. Name the circuit, not the person; no
addresses, no account numbers, no serials. The guard scans the shipped output for the excluded
categories either way.

# ADS-B Overlay

Windy plugin that shows live aircraft positions, received via ADS-B, over the currently visible map area.

## Language

**Aircraft**:
One transponder-equipped flying or taxiing vehicle, identified by its ICAO 24-bit address (`hex`).
_Avoid_: Plane, flight, target

**Callsign**:
The flight identifier the aircraft broadcasts (e.g. `AFR32XQ`); may be absent.
_Avoid_: Flight number, flight

**Live Window**:
The 10-second period during which the plugin polls for aircraft every 2 seconds; afterwards the shown positions freeze until the next Live Window.
_Avoid_: Session, burst, refresh period

**Paused**:
State outside a Live Window: last known aircraft stay visible but dimmed, marked with the time of their data.
_Avoid_: Stopped, idle, stale

**Cooldown**:
The ~30-second period after a failed poll (assumed rate limit) during which no Refresh is possible.
_Avoid_: Backoff, throttle

**Refresh**:
User action that starts a new Live Window.
_Avoid_: Reload, update

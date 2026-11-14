# HomePilot backend

Django REST API for the HomePilot room. The same API serves the React dashboard
and the ESP32 firmware. The firmware lives in a separate PlatformIO project
(not in this repository); see its own README for Wi-Fi/backend configuration.

## Device control API

HomePilot controls one room device: a light and a fan. There is a single
`Device` row, created automatically on first use, so no device id appears in
the URL.

Dashboard / user endpoints:

- `GET /api/device/` — the current state:
  - desired: `light_state`, `fan_state`
  - reported: `reported_light_state`, `reported_fan_state`. `null` means the
    hardware has not reported yet, which is **not** the same as off.
  - `revision` (the current desired-state revision) and `reported_revision`
    (the last revision the hardware acknowledged), plus `last_reported_at`.
- `PATCH /api/device/` with `{"light_state": true|false}` and/or
  `{"fan_state": true|false}` — stores the requested state(s). It never changes
  a reported state. Changing a desired state increments `revision`; sending the
  state it already has changes nothing and does not bump the revision.

Firmware endpoints (used by the ESP32):

- `GET /api/device/desired/` —
  `{"light_state": ..., "fan_state": ..., "revision": N}`. The firmware polls
  this, applies any change, and remembers the revision it applied.
- `POST /api/device/report/` — the hardware reports its actual states and the
  revision it applied:
  `{"reported_light_state": true|false, "reported_fan_state": true|false, "revision": N}`.
  At least one reported state is required; `revision` is optional. This is the
  only place reported states change.

### Request and acknowledgement flow

1. The user clicks Light or Fan on the dashboard.
2. The dashboard PATCHes the desired state to Django.
3. Django stores the desired state and increments `revision`.
4. The ESP32 polls `GET /api/device/desired/` and compares `revision` with the
   last revision it applied.
5. The ESP32 applies the change and reports the result through
   `POST /api/device/report/`, including the revision it applied.
6. The dashboard polls `GET /api/device/` and displays the reported state.

A successful dashboard request never means the hardware changed state. The
dashboard shows a request as pending until the reported state matches the
desired state, and shows "unknown" until the hardware reports at all.

## Security requirements before hardware deployment

The current development build deliberately has **no authentication** so the
dashboard can be used locally. Before exposing this API to real devices or a
network, add:

- Per-device authentication and authorization, such as a unique device token or
  API key, so only the firmware can report states and only the dashboard can
  change desired states.
- Transport encryption (HTTPS) and authenticated dashboard access.
- Rate limiting and request-size limits on the device and sensor endpoints.
- An audit trail for state changes (the API deliberately keeps no command log).
- Restricted CORS and secret rotation; do not publish the development
  `SECRET_KEY` or expose this configuration to the internet.

## Tests

Run the backend tests from this directory:

```bash
python manage.py test
```

The device tests exercise the API over HTTP. They simulate a device reading the
desired states and reporting its actual states; they do not prove that physical
hardware executed a change.

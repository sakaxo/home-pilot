# HomePilot backend

Django REST API for the HomePilot room. The same API serves the React
dashboard and, later, the ESP32 firmware. The firmware itself is not part of
this repository.

## Device control API

A device identifies itself with the UUID returned by `GET /api/devices/`.

Dashboard / user endpoints:

- `GET /api/devices/` — registered devices with `desired_state` and the
  device-reported `reported_state`.
- `PATCH /api/devices/<device_id>/` with `{"desired_state": true|false}` —
  stores the requested state and creates a `pending` command. It never changes
  `reported_state`.
- `GET /api/devices/commands/?limit=20` — command history. Optional `device`
  and `status` filters are supported.
- `GET /api/devices/commands/<command_id>/` — one command.

Firmware endpoints (ready for future integration):

- `POST /api/devices/<device_id>/commands/claim/` — atomically claims the
  oldest `pending` command for that device and returns it with status
  `in_progress`. Returns `204 No Content` when nothing is pending. Because the
  claim is a conditional database update, duplicate polls cannot claim or
  execute the same command twice.
- `POST /api/devices/commands/<command_id>/result/` — reports the execution
  result. Body:
  `{"status": "confirmed"|"failed", "result_message": "...", "reported_state": true|false}`.
  `reported_state` is optional. A confirmed result also updates the device's
  reported state (to the command target, or to the supplied `reported_state`).
  A failed result leaves the reported state unchanged unless the device sends
  its actual state.
- `POST /api/devices/<device_id>/state/` with `{"reported_state": true|false}`
  — reports the device's actual state independently of a command.

### Command lifecycle

```
pending -> in_progress -> confirmed | failed
```

Only a device claim moves a command to `in_progress`. Only a device execution
report moves it to `confirmed` or `failed`. The dashboard cannot create an
already-completed command. `reported_state` changes only from a device state
report or a confirmed execution report, never from a user click.

## Security requirements before hardware deployment

The current development build deliberately has **no authentication** so the
dashboard can be used locally. Before exposing this API to real devices or a
network, add:

- Per-device authentication and authorization, such as a unique device token or
  API key, so a device can only claim/report for its own UUID.
- Transport encryption (HTTPS) and authenticated dashboard access.
- Rate limiting and request-size limits on device and sensor endpoints.
- A command-expiry/reclaim policy for commands claimed but never completed,
  plus an audit trail for state changes.
- Restricted CORS and secret rotation; do not publish the development
  `SECRET_KEY` or expose this configuration to the internet.

## Tests

Run the backend tests from this directory:

```bash
python manage.py test
```

The device lifecycle tests exercise the API over HTTP. They simulate a device's
claim and execution report; they do not prove that physical hardware executed a
command.

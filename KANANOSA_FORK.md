# Kananosa fork notes

This fork is used for the TechLearn classroom deployment.

Changes from upstream:

- `frontend/src/pages/EmbedPage.tsx` adds an iframe-friendly `/embed` route.
  - loads a built-in example via `?example=<id>`
  - accepts a `.vlx` project from the parent page via `postMessage`
  - protocol: `velxio:ready` / `velxio:load-project` / `velxio:loaded` / `velxio:error`
  - grading protocol: `velxio:serial` / `velxio:pin` / `velxio:run-state` /
    `velxio:trace-reset`, plus `velxio:configure` from the parent to limit
    captured pins
- `backend/app/services/arduino_cli.py` supports `VELXIO_AVR_ONLY=1`, which skips
  the startup network refresh of ESP32/RP2040/ATtiny board indexes for the
  AVR-only classroom deployment.

The upstream project is AGPLv3. This fork is published under the same license.

---
name: Cashier Bluetooth printer (Web Bluetooth)
description: Why the POS thermal printer drops connection and how the app keeps it alive
---

- Printers auto-sleep BLE after idle → keepalive DLE EOT (0x10 0x04 0x01) every 15s; it does not print.
- SPA navigation never kills GATT; the real killer is a FULL page reload. pagePreloader's chunk-load-error handler does `window.location.reload()` after a deploy (stale chunk hashes) — that is what users perceive as "printer disconnects when I open event-pos".
- **Why:** Web Bluetooth connections die on any document unload; only `navigator.bluetooth.getDevices()` (Chrome desktop/Android) allows silent reconnect without a user gesture.
- **How to apply:** auto-reconnect must live at App level (App.tsx mount + visibilitychange + 10s watchdog in client/src/lib/thermal-printer.ts), never only inside POS pages. Arabic receipts print as canvas raster (GS v 0) so printer font support is irrelevant. Paper width stored in localStorage (58/80mm → 384/576 dots).
- User tests on production (thebutterbakery.com via Render); fixes are invisible until pushed to GitHub + Render deploy + hard refresh. Always state this explicitly.

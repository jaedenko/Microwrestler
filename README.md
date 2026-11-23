# Wrestler leg bench
Static page (Vercel: import repo, no config) that drives the leg over Web Serial (Chrome/Edge) and simulates it on screen.
- `index.html` the app. Flash `firmware/bridge/bridge.ino` to a Nano + PCA9685 first.
- `firmware/tune`, `firmware/leg_test` serial-monitor tuner and IK test sketch.
- `sim/` MuJoCo model (`python wrestler.py`). Checks: `node test_core.js`, `node e2e.js` (needs playwright).

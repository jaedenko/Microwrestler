# Wrestler leg bench
Static page (Vercel: import repo, no config) that drives the leg over Web Serial (Chrome/Edge) and simulates it on screen.
- `index.html` the app. Flash `firmware/bridge/bridge.ino` to a Nano + PCA9685 first.
- `firmware/tune`, `firmware/leg_test` serial-monitor tuner and IK test sketch.
- `sim/` MuJoCo model (`python wrestler.py`). `assets/`+`tools/export_model.py` (meshes) and `tools/make_logo.py` (the logo, a front silhouette of the crouched CAD model) the STEP-derived meshes for the 3D view (`vendor/` is three.js 0.160). Checks: `node test_core.js`; `python -m http.server 8123` then `node e2e.js` (needs playwright).

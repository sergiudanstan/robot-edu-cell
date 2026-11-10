# Robot Educational Cell

An LR Mate 200iD/4S picks ten nylon cylinders from one Solitaire triangle and places them in the other. The page shows the program listing, the I/O lamps, the joint state and the view from the ceiling camera.

Live page: https://sergiudanstan.github.io/robot-edu-cell/

FANUC, LR Mate, R-30iB, iPendant and iRVision are trademarks of FANUC Corporation; these names are used descriptively. This is an independent educational project, not affiliated with or endorsed by FANUC.

The arm meshes are the ROS-Industrial visual meshes for the LR Mate 200iD/4S (`assets/lrmate200id4s.glb`), copyright 2012–2015 TU Delft Robotics Institute, BSD-3-Clause. The licence text is `assets/LICENSE-ros-industrial.txt`. The kinematic chain is the vendored macro `assets/lrmate200id4s.urdf.xacro` from `ros-industrial/fanuc`.

Cell dimensions are estimated from photographs. The silver frame is 1100 mm wide and 940 mm deep, shifted back so the home pose stays clear of the rear panel. A 750 mm depth could not. Castor diameter is 75 mm, which is short of the gap under the posts; that height is an estimate.

The cycle lasts 24.0 s. The smallest capsule clearance is 28.3 mm, between the forearm and the rear panel at 0.9 s.

Serve the repository over HTTP (`python3 -m http.server 8000`) and open `http://localhost:8000/`, or use the live page. Edit the files in `src/` and run `node tools/build.mjs`.

## Checks

- `node tests/run.mjs` checks the cycle logic.
- `node tests/robot_geometry.mjs` checks the LR Mate link frames, the 330 / 260 / 20 / 290 / 70 mm spans, and the URDF chain against `fk`. It reads `assets/lrmate200id4s.urdf.xacro`.

Both checks must exit 0. Run `node tests/run.mjs --perturb`, `node tests/run.mjs --perturb2` and `node tests/robot_geometry.mjs --perturb` separately; each must exit 1. Exit 2 indicates an incomplete check. The geometry test loads Three.js 0.186.1 from jsDelivr in memory and requires network access. It checks link frames, bounding envelopes and FK, not exact surface equivalence or physical safety.

## Local paths

Code: `~/code/robot-edu-cell`. Screenshots: `~/Downloads/robot_edu_cell/shots/`. The recording script writes `~/Downloads/robot_edu_cell/robot_edu_cell.mp4`. Captures and videos are local deliverables, excluded from Git; they must be regenerated after visual changes.

# FANUC Educational Cell

A browser model of the FANUC Europe Robotic (Standard) Educational Package. An LR Mate 200iD/4S picks ten nylon cylinders from one Solitaire triangle and places them in the other. The page shows the TP listing, the I/O lamps, the joint state and the view from the ceiling camera.

FANUC, LR Mate, ER-4iA, R-30iB, iPendant and iRVision are trademarks of FANUC Corporation. This page is an independent teaching model. It is not a FANUC product and it does not contain FANUC CAD or documentation.

The arm geometry follows FANUC public datasheets for the LR Mate 200iD/4S: 4 kg payload, 550 mm reach. Cell dimensions are estimated from photographs. In this model the silver frame is 1100 mm wide and 940 mm deep, shifted back so the home pose stays clear of the rear panel. A 750 mm depth could not. Castor diameter is 75 mm, which is short of the gap under the posts; that height is an estimate.

The cycle lasts 24.0 s. The smallest capsule clearance is 28.3 mm, between the forearm and the rear panel at 0.9 s.

Open `index.html` in a browser, or use the GitHub Pages link. Edit the files in `src/` and run `node tools/build.mjs`. Logic checks are `node tests/run.mjs`.

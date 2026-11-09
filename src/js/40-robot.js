// T0 stub. C2 replaces this file with the LR Mate 200iD/4S.
// Mount: group at LAYOUT.robot, yaw +90° so local +x (WORLD +X) points along scene +y.
// scene cell = (robot.x - Y, robot.y + X, 0.330 + Z) with WORLD metres, origin at J2 height.
const robotRoot = new THREE.Group();
robotRoot.position.set(LAYOUT.robot.x, LAYOUT.robot.y, 0);
robotRoot.rotation.z = LAYOUT.robot.yawDeg * Math.PI / 180;
world.add(robotRoot);
function buildRobot() {}
function setRobot() {}
function robotCheck() { return 0; }
window.pcHooks = Object.assign(window.pcHooks || {}, { robotCheck });

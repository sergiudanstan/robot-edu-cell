// T0 stub. C2 replaces this file with the LR Mate 200iD/4S.
// Mount: group at LAYOUT.robot, yaw +90° so local +x (WORLD +X) points along scene +y.
// scene cell = (robot.x - Y, robot.y + X, 0.330 + Z) with WORLD metres, origin at J2 height.
const robotRoot = new THREE.Group();
robotRoot.position.set(LAYOUT.robot.x, LAYOUT.robot.y, 0);
robotRoot.rotation.z = LAYOUT.robot.yawDeg * Math.PI / 180;
world.add(robotRoot);
// Placeholder mass until C2. Base 160 mm, J2 height 330 mm. C2 replaces these meshes.
box(0.160, 0.160, 0.169, M.fanucBlack, 0, 0, 0.0845, robotRoot);
vcyl(0.063, 0.14, M.fanucYellow, 0, 0, 0.26, 24, robotRoot);
function buildRobot() {}
function setRobot() {}
function robotCheck() { return 0; }
window.pcHooks = Object.assign(window.pcHooks || {}, { robotCheck });

// T0 stub. G1 replaces this file with the frame, door, worktop, shelf and castors.
const floorMat = mat(0x8a8e92, 0.92, 0.02);
const floor = mesh(new THREE.PlaneGeometry(8, 8), floorMat);
floor.position.z = LAYOUT.floor;
floor.receiveShadow = true;
const guardPanels = [];
Object.defineProperty(guardPanels, "visible", {
  get() { return guardPanels.length === 0 || guardPanels.every((o) => o.visible); },
  set(v) { for (const o of guardPanels) o.visible = v; },
});

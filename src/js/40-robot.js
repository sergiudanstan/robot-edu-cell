// LR Mate 200iD/4S from CAD-derived meshes: ROS-Industrial fanuc_lrmate200id_support, meshes/lrmate200id4s/visual
// (BSD-3-Clause, see assets/LICENSE-ros-industrial.txt), packed as assets/lrmate200id4s.glb: one node per URDF link,
// metres, each node in its own link frame. The chain below copies urdf/lrmate200id4s_macro.xacro.
// Gripper and labels are this project's own [E] models.
const ROBOT_GLB = 'assets/lrmate200id4s.glb';
const URDF_JOINTS = [   // origin xyz in the parent link frame (m), rotation axis
  { xyz: [0, 0, 0.330], axis: [0, 0, 1] },    // joint_1  base_link -> link_1
  { xyz: [0, 0, 0], axis: [0, 1, 0] },        // joint_2  link_1 -> link_2
  { xyz: [0, 0, 0.260], axis: [0, -1, 0] },   // joint_3  link_2 -> link_3
  { xyz: [0, 0, 0.020], axis: [-1, 0, 0] },   // joint_4  link_3 -> link_4
  { xyz: [0.290, 0, 0], axis: [0, -1, 0] },   // joint_5  link_4 -> link_5
  { xyz: [0.070, 0, 0], axis: [-1, 0, 0] },   // joint_6  link_5 -> link_6
];
const ROBOT_LINK_MATERIAL = { base_link: 'fanucBlack', link_1: 'fanucYellow', link_2: 'fanucYellow', link_3: 'fanucYellow',
  link_4: 'fanucYellow', link_5: 'fanucYellow', link_6: 'fanucBlack' };
// FANUC J1..J6 in degrees, J3 measured from horizontal -> URDF joint angles in radians. URDF joint_3 = J2 + J3.
const urdfAngles = (q) => [q[0], q[1], q[1] + q[2], q[3], q[4], q[5]].map((v) => v * D2R);
function robotTurned(r, z0, z1, material, parent, segments = 40) {
  const b = Math.min(0.0006, (z1 - z0) / 4, r / 4);
  return lathe([[0, z0], [r-b, z0], [r, z0+b], [r, z1-b], [r-b, z1], [0, z1]], material, parent, segments);
}
function robotScrew(x,y,z,normal,parent) {
  const o=robotTurned(0.0035,0,0.0028,M.steel,parent,16);
  o.position.set(x,y,z);o.quaternion.setFromUnitVectors(V(0,0,1),normal);
  const socket=robotTurned(0.0015,0.0028,0.0029,M.fanucBlack,parent,6);
  socket.position.copy(o.position);socket.quaternion.copy(o.quaternion);
}
// Merge only direct meshes of one rigid link; joints, gripper fingers and their transforms survive.
function mergeRobotLink(group) {
  const batches=new Map();
  for(const o of [...group.children]) {
    if(!o.isMesh||o.isInstancedMesh)continue;
    o.updateMatrix();let g=o.geometry.clone();
    if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}
    g.applyMatrix4(o.matrix);
    for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(!batches.has(o.material))batches.set(o.material,[]);
    batches.get(o.material).push(g);group.remove(o);o.geometry.dispose();
  }
  for(const [material,geos] of batches){const g=BufferGeometryUtils.mergeGeometries(geos,false);if(!g)throw Error('Robot link merge failed');geos.forEach(g=>g.dispose());mesh(g,material,group);}
}
// Labels sit 0.5 mm proud of flat mesh faces found by ray casts on the GLB (base side has a 1.8° draft).
function robotLabels(links) {
  const draft=Math.atan(0.032);
  const plate=labelPlane('LR Mate 200iD/4S',0.065,0.020,{bg:'#a7aaa8',fg:'#202222'});
  plate.position.set(0,-0.0790,0.060);plate.rotation.x=Math.PI/2-draft;links[0].add(plate);
  const warning=labelPlane('CAUTION',0.045,0.025,{bg:'#edc12b',fg:'#171717'});
  warning.position.set(0,-0.0775,0.108);warning.rotation.x=Math.PI/2-draft;links[0].add(warning);
  const brand=labelPlane('FANUC',0.080,0.020,{bg:'#f5c221',fg:'#a41d25'});
  brand.rotation.set(Math.PI/2,0,Math.PI/2);brand.position.set(-0.003,-0.0955,0.150);links[2].add(brand);
  const name=labelPlane('LR Mate 200iD/4S',0.145,0.015,{bg:'#f5c221',fg:'#332b19'});
  name.rotation.x=Math.PI/2;name.position.set(0.190,-0.0465,0);links[4].add(name);
}
function buildRobotGripper(tool0) {
  const gripper=new THREE.Group();gripper.name='electric gripper';tool0.add(gripper);
  rbox(0.060,0.045,0.075,0.003,M.gripperBody,0,0,0.0375,gripper);
  rbox(0.050,0.046,0.006,0.0015,M.gripperFinger,0,0,0.072,gripper);
  rbox(0.048,0.0015,0.040,0.0005,M.fanucBlack,0,-0.0228,0.036,gripper);
  for(const x of [-0.021,0.021])for(const z of [0.013,0.060])robotScrew(x,-0.0238,z,V(0,-1,0),gripper);
  const plug=robotTurned(0.004,0,0.008,M.fanucBlack,gripper);plug.rotation.x=Math.PI/2;plug.position.set(0.022,-0.0225,0.018);
  const coil=[V(0.022,-0.0305,0.018)];
  for(let i=0;i<=80;i++){const t=i/80,a=t*Math.PI*12;coil.push(V(0.025+0.003*Math.cos(a),-0.0305+0.003*Math.sin(a),0.018-0.026*t));}
  coil.push(V(0.016,-0.016,-0.008));tubeAlong(coil,0.0012,M.blackRubber,gripper,96,8);
  mergeRobotLink(gripper);
  const fingers=[-1,1].map(sg=>{const f=rbox(0.012,0.010,0.050,0.0015,M.gripperFinger,sg*0.018,0,0.100,gripper);f.userData.sg=sg;return f;});
  const tcp=new THREE.Group();tcp.name='UT1 TCP';tcp.position.z=UT1.z;gripper.add(tcp);
  return {gripper,fingers,tcp};
}
async function loadRobotMeshes(links) {
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(ROBOT_GLB);
    links.forEach((link) => {
      const node = gltf.scene.getObjectByName(link.name);
      if (!node?.isMesh) throw Error(`node ${link.name} missing in ${ROBOT_GLB}`);
      // STL-derived geometry has no normals: split at 35° creases so cast edges stay sharp and bores stay round.
      const geo = BufferGeometryUtils.toCreasedNormals(node.geometry, 35 * D2R);
      mesh(geo, M[ROBOT_LINK_MATERIAL[link.name]], link).name = link.name + ' mesh';
    });
    return true;
  } catch (err) {
    console.warn(`LR Mate 200iD/4S: CAD meshes not loaded from ${ROBOT_GLB} (${err.message}). Showing a stick model; serve the folder over http.`);
    links.slice(1).forEach((link, i) => {   // stick fallback along the URDF joint offsets
      const next = URDF_JOINTS[i + 2]?.xyz ?? [0.012, 0, 0], len = Math.hypot(...next);
      const o = rod(0.025, M.fanucYellow); link.add(o); placeRod(o, V(0, 0, 0), V(...next).setLength(Math.max(len, 0.04)));
    });
    return false;
  }
}
function buildRobot() {
  const root=new THREE.Group();root.name='LR Mate 200iD/4S';root.position.set(LAYOUT.robot.x,LAYOUT.robot.y,0);root.rotation.z=LAYOUT.robot.yawDeg*D2R;world.add(root);
  const base=new THREE.Group();base.name='base_link';root.add(base);   // mounting face on the worktop, z = 0
  const links=[base];
  URDF_JOINTS.forEach((j,i)=>{const g=new THREE.Group();g.name=`link_${i+1}`;g.position.set(...j.xyz);g.userData.axis=V(...j.axis);links[i].add(g);links.push(g);});
  // ROS-I flange-tool0: rpy (pi, -pi/2, 0) = FANUC flange frame (tool +z along link_6 +x).
  const tool0=new THREE.Group();tool0.name='tool0';tool0.rotation.copy(new THREE.Euler(Math.PI,-Math.PI/2,0,'ZYX'));links[6].add(tool0);
  robotLabels(links);
  const {gripper,fingers,tcp}=buildRobotGripper(tool0);
  const ready=loadRobotMeshes(links);
  return {root,links,tool0,flange:tool0,gripper,fingers,tcp,ready,q:[...HOME],grip:0};
}
const robotModel=buildRobot(),robotRoot=robotModel.root;
function setRobot(q,grip=0) {
  if(!Array.isArray(q)||q.length!==6||!q.every(Number.isFinite)||!Number.isFinite(grip))throw Error('Invalid robot pose');
  const m=robotModel;
  urdfAngles(q).forEach((a,i)=>{const link=m.links[i+1];link.quaternion.setFromAxisAngle(link.userData.axis,a);});
  const gap=0.024*(1-clamp(grip,0,1));
  m.fingers.forEach(f=>{f.position.x=f.userData.sg*(gap/2+0.006);});
  m.q=[...q];m.grip=clamp(grip,0,1);
}
// Max distance (mm) between tool0 of the URDF mesh chain and fk(q) from the logic, over random in-limit poses.
// Points 100 mm along tool0 x and z are compared too, so the flange orientation is checked as well.
function robotCheck(samples=null) {
  const m=robotModel,savedQ=[...m.q],savedGrip=m.grip;
  if(samples===null)samples=Array.from({length:50},()=>{
    const q=KIN.lim.map(([lo,hi])=>lo+(hi-lo)*Math.random());q[2]-=q[1];return q;
  });
  if(!Array.isArray(samples)||!samples.length)throw Error('No robot check samples');
  let maxMM=0;
  try {
    for(const q of samples){setRobot(q,savedGrip);world.updateWorldMatrix(true,true);
      const f=fk(q);
      for(const [k,d] of [[-1,0],[0,0.1],[2,0.1]]){
        const actual=world.worldToLocal(m.tool0.localToWorld(V(k===0?d:0,0,k===2?d:0)));
        const expected=worldToScene(f.p.map((v,i)=>v+(k<0?0:1000*d*f.R[i][k])));
        const mm=actual.distanceTo(V(...expected))*1000;if(!Number.isFinite(mm))throw Error('Non-finite robot check');maxMM=Math.max(maxMM,mm);
      }
    }
  } finally {setRobot(savedQ,savedGrip);world.updateWorldMatrix(true,true);}
  return maxMM;
}
// Joint-origin distances (mm) at the URDF zero pose, read from the placed link frames.
function robotMeasure() {
  const m = robotModel, savedQ = [...m.q], savedGrip = m.grip;
  setRobot([0, 0, 0, 0, 0, 0], savedGrip);
  world.updateWorldMatrix(true, true);
  const cell = (obj) => world.worldToLocal(obj.getWorldPosition(V(0, 0, 0)));
  const pts = m.links.map(cell);
  const mm = (a, b) => a.distanceTo(b) * 1000;
  const meshes = m.links.map((link) => link.getObjectByName(link.name + ' mesh'));
  const out = {
    j2Height: mm(pts[0], pts[1]),
    arm: mm(pts[2], pts[3]),
    j3Offset: mm(pts[3], pts[4]),
    forearm: mm(pts[4], pts[5]),
    flange: mm(pts[5], pts[6]),
    meshes: meshes.every(Boolean),
    colors: Object.fromEntries(meshes.filter(Boolean).map((o) => [o.parent.name, '#' + o.material.color.getHexString()])),
  };
  setRobot(savedQ, savedGrip);
  world.updateWorldMatrix(true, true);
  return out;
}
// NDC extent of the CAD links plus the gripper on the current camera. Visible is −1…1.
function robotFrame() {
  world.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const objects = [...robotModel.links.map((link) => link.getObjectByName(link.name + ' mesh')), robotModel.gripper];
  for (const obj of objects) {
    if (!obj) continue;
    box.setFromObject(obj);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = V(x, y, z).project(camera);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, maxX, minY, maxY };
}
setRobot(HOME,0);
window.pcHooks=Object.assign(window.pcHooks||{},{robotCheck, robotMeasure, robotFrame});
queueMicrotask(()=>{if(window.pc){window.pc.robotCheck=robotCheck;window.pc.robotMeasure=robotMeasure;window.pc.robotFrame=robotFrame;window.pc.robotReady=robotModel.ready;}});

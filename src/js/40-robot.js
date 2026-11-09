// LR Mate 200iD/4S, procedural. Kinematic dimensions: PLAN §6 / robot_spec.md (metres).
// Casting contours, cover depths, connector placement and fasteners are [E] photo estimates.
// No external dress pack: only the short electric-gripper lead is visible.
function robotTurned(r, z0, z1, material, parent, segments = 40) {
  const b = Math.min(0.0006, (z1 - z0) / 4, r / 4);
  return lathe([[0, z0], [r-b, z0], [r, z0+b], [r, z1-b], [r-b, z1], [0, z1]], material, parent, segments);
}
function robotSideDisk(r, y0, y1, x, z, material, parent) {
  const o = robotTurned(r, 0, y1-y0, material, parent);
  o.rotation.x = -Math.PI/2; o.position.set(x,y0,z); return o;
}
function robotScrew(x,y,z,normal,parent) {
  const o=robotTurned(0.0035,0,0.0028,M.steel,parent,16);
  o.position.set(x,y,z);o.quaternion.setFromUnitVectors(V(0,0,1),normal);
  const socket=robotTurned(0.0015,0.0028,0.0029,M.fanucBlack,parent,6);
  socket.position.copy(o.position);socket.quaternion.copy(o.quaternion);
}
function robotCover(x,z,r,y,sg,parent) {
  robotSideDisk(r,y-0.0015,y+0.0015,x,z,M.fanucBlack,parent);
  robotSideDisk(r-0.003,Math.min(y,y+sg*0.007),Math.max(y,y+sg*0.007),x,z,M.fanucYellow,parent);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;robotScrew(x+(r-0.009)*Math.cos(a),y+sg*0.007,z+(r-0.009)*Math.sin(a),V(0,sg,0),parent);}
}
// Convex outline of circular cast ends, in x/z; bevels keep the long link from looking box-like.
function robotLinkOutline(length,r0,r1) {
  const points=[];
  for(const [z,r] of [[0,r0],[length,r1]])for(let i=0;i<48;i++){const a=i*Math.PI/24;points.push([r*Math.cos(a),z+r*Math.sin(a)]);}
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],hi=[];
  for(const p of points){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
  for(const p of points.slice().reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}
  return lo.slice(0,-1).concat(hi.slice(0,-1));
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
function buildRobot() {
  const root=new THREE.Group();root.name='LR Mate 200iD/4S';root.position.set(LAYOUT.robot.x,LAYOUT.robot.y,0);root.rotation.z=LAYOUT.robot.yawDeg*D2R;world.add(root);
  const joint=(name,parent,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
  // Fixed 160 mm base, mounting face z=0; black controller/connector casting height 169 mm.
  rbox(0.160,0.160,0.014,0.004,M.fanucBlack,0,0,0.007,root);
  extrudeXZ([[-0.075,0.014],[0.075,0.014],[0.078,0.140],[0.063,0.169],[-0.063,0.169],[-0.078,0.140]],-0.074,0.074,M.fanucBlack,root,0.006);
  for(const x of [-0.064,0.064])for(const y of [-0.064,0.064])robotScrew(x,y,0.014,V(0,0,1),root);
  rbox(0.008,0.105,0.108,0.003,M.fanucBlack,-0.080,0,0.081,root);
  for(const [y,z,r] of [[-0.030,0.060,0.011],[0,0.060,0.008],[0.030,0.060,0.006],[-0.024,0.105,0.005],[0.022,0.105,0.005]]) {
    const socket=robotTurned(r,0,0.008,M.steel,root);socket.rotation.y=-Math.PI/2;socket.position.set(-0.084,y,z);
    const insert=robotTurned(r*0.65,0,0.001,M.fanucBlack,root);insert.rotation.y=-Math.PI/2;insert.position.set(-0.092,y,z);
  }
  const plate=labelPlane('LR Mate 200iD/4S',0.065,0.020,{bg:'#a7aaa8',fg:'#202222'});
  plate.position.set(0,-0.0741,0.060);plate.rotation.x=Math.PI/2;root.add(plate);
  const warning=labelPlane('CAUTION',0.045,0.025,{bg:'#edc12b',fg:'#171717'});
  warning.position.set(0,-0.0742,0.108);warning.rotation.x=Math.PI/2;root.add(warning);
  const j1=joint('J1',root);
  robotTurned(0.080,0.169,0.177,M.fanucBlack,j1);
  // Asymmetric turret plan envelope: forward R106, rear R122; narrowed near the shoulder.
  extrudeXZ([[-0.075,0.177],[0.075,0.177],[0.106,0.210],[0.078,0.265],[0.063,0.330],[0.040,0.376],[-0.040,0.376],[-0.063,0.330],[-0.075,0.270],[-0.122,0.225]],-0.062,0.062,M.fanucYellow,j1,0.008);
  // Shoulder axis and motor cover envelope span 190 mm, casting rear radius 63 mm.
  robotSideDisk(0.063,-0.086,0.086,0,ROBOT.zJ2,M.fanucYellow,j1);
  robotCover(0,ROBOT.zJ2,0.057,-0.088,-1,j1);robotCover(0,ROBOT.zJ2,0.057,0.088,1,j1);
  const j2=joint('J2',j1,0,0,ROBOT.zJ2);
  const a2=KIN.a2/1000,a3=KIN.a3/1000,d4=KIN.d4/1000,d6=KIN.d6/1000;
  extrudeXZ(robotLinkOutline(a2,0.049,0.060),-0.042,0.042,M.fanucYellow,j2,0.006);
  // Slightly proud side cover follows the long cast link. [E] seam and bolt spacing.
  extrudeXZ(robotLinkOutline(a2-0.030,0.037,0.046).map(([x,z])=>[x,z+0.015]),-0.044,-0.042,M.fanucBlack,j2,0.0005);
  extrudeXZ(robotLinkOutline(a2-0.030,0.035,0.044).map(([x,z])=>[x,z+0.015]),-0.047,-0.044,M.fanucYellow,j2,0.001);
  for(const z of [0.020,0.080,0.180,0.245])for(const sg of [-1,1])robotScrew(sg*0.033,-0.047,z,V(0,-1,0),j2);
  const brand=labelPlane('FANUC',0.080,0.020,{bg:'#f5c221',fg:'#a41d25'});
  brand.rotation.set(Math.PI/2,0,Math.PI/2);brand.position.set(0,-0.0472,0.130);j2.add(brand);
  const j3=joint('J3',j2,0,0,a2);
  robotSideDisk(0.075,-0.046,0.046,0,0,M.fanucYellow,j3);
  robotCover(0,0,0.058,0.047,1,j3);robotCover(0,0,0.058,-0.047,-1,j3);
  // J4 is on the forearm axis, offset 20 mm above the elbow. Forearm rotates about +x.
  const j4=joint('J4',j3,0,0,a3);
  const bearing=robotTurned(0.050,-0.005,0.020,M.fanucBlack,j4);bearing.rotation.y=Math.PI/2;
  // Tapered yellow forearm, 290 mm centre-to-centre; 100 mm at its broad end, 74 mm wrist.
  extrudeXZ([[0.010,-0.040],[0.060,-0.047],[0.190,-0.037],[0.255,-0.030],[0.278,-0.020],
    [0.278,0.020],[0.255,0.030],[0.190,0.037],[0.060,0.047],[0.010,0.040]],-0.047,0.047,M.fanucYellow,j4,0.005);
  // Flattened removable side panels with seams and small steel socket screws.
  extrudeXZ([[0.035,-0.031],[0.225,-0.025],[0.260,0],[0.225,0.025],[0.035,0.031]],-0.047,-0.045,M.fanucBlack,j4,0.0005);
  extrudeXZ([[0.038,-0.029],[0.223,-0.023],[0.255,0],[0.223,0.023],[0.038,0.029]],-0.049,-0.047,M.fanucYellow,j4,0.0005);
  for(const x of [0.045,0.135,0.225])for(const z of [-0.021,0.021])robotScrew(x,-0.049,z,V(0,-1,0),j4);
  const name=labelPlane('LR Mate 200iD/4S',0.145,0.015,{bg:'#f5c221',fg:'#332b19'});
  name.rotation.x=Math.PI/2;name.position.set(0.140,-0.0492,0.003);j4.add(name);
  const j5=joint('J5',j4,d4,0,0);
  robotSideDisk(0.037,-0.032,0.032,0,0,M.fanucYellow,j5);
  robotSideDisk(0.025,-0.037,-0.032,0,0,M.fanucBlack,j5);
  robotSideDisk(0.025,0.032,0.037,0,0,M.fanucYellow,j5);
  const wrist=robotTurned(0.028,0.008,d6-0.006,M.fanucYellow,j5);wrist.rotation.y=Math.PI/2;
  // FANUC flange frame R_TOOL maps local +z onto the preceding frame's +x.
  // Its fixed alignment is followed by the single J6 rotation about flange-local z.
  const j6=joint('J6 flange',j5,d6,0,0);
  const flangeBasis=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI,-Math.PI/2,0,'YXZ'));
  robotTurned(0.020,-0.006,0,M.fanucFlange,j6);
  // ISO 9409-1-31.5-4-M5 face pattern. [E] visible recessed holes, rather than invented bolt heads.
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const hole=robotTurned(0.0025,0,0.00015,M.fanucBlack,j6,16);hole.position.set(0.01575*Math.cos(a),0.01575*Math.sin(a),0);}
  const gripper=joint('electric gripper',j6);
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
  const tcp=joint('UT1 TCP',gripper,0,0,UT1.z);
  for(const link of [root,j1,j2,j3,j4,j5,j6])mergeRobotLink(link);
  return {root,j1,j2,j3,j4,j5,j6,flange:j6,flangeBasis,gripper,fingers,tcp,q:[...HOME],grip:0};
}
const robotModel=buildRobot(),robotRoot=robotModel.root;
function setRobot(q,grip=0) {
  if(!Array.isArray(q)||q.length!==6||!q.every(Number.isFinite)||!Number.isFinite(grip))throw Error('Invalid robot pose');
  const m=robotModel,a=q.map(v=>v*D2R);
  m.j1.rotation.z=a[0];m.j2.rotation.y=a[1];
  // FANUC J3 is absolute from horizontal; the actual relative elbow is -(J2+J3).
  m.j3.rotation.y=-(a[1]+a[2]);m.j4.rotation.x=-a[3];m.j5.rotation.y=-a[4];
  m.j6.quaternion.copy(m.flangeBasis).multiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-a[5]));
  const gap=0.024*(1-clamp(grip,0,1));
  m.fingers.forEach(f=>{f.position.x=f.userData.sg*(gap/2+0.006);});
  m.q=[...q];m.grip=clamp(grip,0,1);
}
function robotCheck(samples=null) {
  const m=robotModel,savedQ=[...m.q],savedGrip=m.grip;
  if(samples===null)samples=Array.from({length:50},()=>{
    const q=KIN.lim.map(([lo,hi])=>lo+(hi-lo)*Math.random());q[2]-=q[1];return q;
  });
  if(!Array.isArray(samples)||!samples.length)throw Error('No robot check samples');
  let maxMM=0;
  try {
    for(const q of samples){setRobot(q,savedGrip);world.updateWorldMatrix(true,true);
      const actual=world.worldToLocal(m.flange.getWorldPosition(V(0,0,0))),expected=worldToScene(fk(q).p);
      const mm=actual.distanceTo(V(...expected))*1000;if(!Number.isFinite(mm))throw Error('Non-finite robot check');maxMM=Math.max(maxMM,mm);
    }
  } finally {setRobot(savedQ,savedGrip);world.updateWorldMatrix(true,true);}
  return maxMM;
}
setRobot(HOME,0);
window.pcHooks=Object.assign(window.pcHooks||{},{robotCheck});
queueMicrotask(()=>{if(window.pc)window.pc.robotCheck=robotCheck;});

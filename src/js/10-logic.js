// @@logic-start — pure JS; FANUC WORLD flange poses in mm, joints in degrees; scene/TCP/UF1 in metres.
// FK/closed-form IK ported from _ref/kin_lrmate_ref.js (4S only). No DOM or rendering dependencies.
// [E] Board dimensions/layout are photo estimates fixed by PLAN §5.4.
const BOARD = {
  x: -0.10, y: -0.08,
  w: 0.260, d: 0.160, h: 0.020, topZ: 0.020,
  holeR: 0.0105, holeD: 0.012,
  pitch: 0.034, row: 0.0294, tri: 0.065,
  cylR: 0.010, cylH: 0.032, chamfer: 0.001,
};

function boardHoles() {
  const rows = [4, 3, 2, 1];
  const holes = [];
  const count = { A: 0, B: 0 };
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "A" : "B";
    const cx = sign * BOARD.tri;
    rows.forEach((n, r) => {
      const x = cx - sign * (r - 1.5) * BOARD.row;
      for (let c = 0; c < n; c++) {
        const y = (c - (n - 1) / 2) * BOARD.pitch;
        count[side] += 1;
        holes.push({
          id: side + count[side], side, i: count[side], row: r, col: c,
          lx: x, ly: y,
          x: BOARD.x + x, y: BOARD.y + y, z: BOARD.topZ,
          ux: x + BOARD.w / 2, uy: y + BOARD.d / 2,
          cz: BOARD.topZ - BOARD.holeD + BOARD.cylH / 2,
        });
      }
    });
  }
  return holes;
}

const HOLES = boardHoles();

const KIN = { a1: 0, a2: 260, a3: 20, d4: 290, d6: 70,
  lim: [[-170,170],[-110,120],[-69,205],[-190,190],[-120,120],[-360,360]] };
const ROBOT = { x: 0.20, y: 0.12, zJ2: 0.330, yawDeg: 90, kin: KIN,
  vmax: [460,360,520,560,560,900], home: [0,0,0,0,-90,0] };
const HOME = ROBOT.home, UT1 = { z: 0.125 }, UF1 = { p: [BOARD.x-BOARD.w/2, BOARD.y-BOARD.d/2, BOARD.topZ] };
const APPROACH = 0.080; // PR[5:APP_Z]; perturb2 replaces only this parameter.
const CAMERA_DROP = 0; // Negative control: tests lower camera + drop bracket by 0.40 m.
// 0.30 m leaves 53 mm (elbow vs lens). 0.40 m enters the forearm. Coordinator 09.11, measured.
const D2R = Math.PI / 180;

// 3x3 helpers, row-major arrays [[..],[..],[..]]
const mul = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const tr = A => [0, 1, 2].map(i => [A[0][i], A[1][i], A[2][i]]);
const Rx = a => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const Ry = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const Rz = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const R_TOOL = mul(Ry(-Math.PI / 2), Rx(Math.PI));     // [[0,0,1],[0,-1,0],[1,0,0]]
const wrap = a => ((a + 180) % 360 + 360) % 360 - 180;

function fk(q, k = KIN) {
        const [q1, q2, q3, q4, q5, q6] = q.map(v => v * D2R);
        const r = k.a1 + k.a2 * Math.sin(q2) + k.d4 * Math.cos(q3) - k.a3 * Math.sin(q3);
        const z = k.a2 * Math.cos(q2) + k.d4 * Math.sin(q3) + k.a3 * Math.cos(q3);
        const R = mul(mul(mul(mul(mul(Rz(q1), Ry(-q3)), Rx(-q4)), Ry(-q5)), Rx(-q6)), R_TOOL);
        const p = [r * Math.cos(q1) + k.d6 * R[0][2], r * Math.sin(q1) + k.d6 * R[1][2], z + k.d6 * R[2][2]];
        return { R, p };
}

function elbowUp(q, k) {
        const q2 = q[1] * D2R, q3 = q[2] * D2R;
        const er = k.a2 * Math.sin(q2), ez = k.a2 * Math.cos(q2);
        const dr = er + k.d4 * Math.cos(q3) - k.a3 * Math.sin(q3);
        const dz = ez + k.d4 * Math.sin(q3) + k.a3 * Math.cos(q3);
        return (dr * ez - dz * er) * dr >= 0;
}

// returns up to 8 solutions [{q:[6 deg], cfg:'N U T'}]
function ikAll({ R, p }, k = KIN) {
        const L3 = Math.hypot(k.d4, k.a3), PHI = Math.atan2(k.a3, k.d4);
        const pw = [p[0] - k.d6 * R[0][2], p[1] - k.d6 * R[1][2], p[2] - k.d6 * R[2][2]];
        const rho = Math.hypot(pw[0], pw[1]);
        const out = [];
        for (const front of [true, false]) {
                const q1 = front ? Math.atan2(pw[1], pw[0]) : Math.atan2(-pw[1], -pw[0]);
                const r = (front ? rho : -rho) - k.a1, h = pw[2];
                const kk = (r * r + h * h - k.a2 * k.a2 - L3 * L3) / (2 * k.a2 * L3);
                if (Math.abs(kk) > 1) continue;                       // out of reach
                for (const up of [true, false]) {
                        const beta = up ? Math.asin(kk) : Math.PI - Math.asin(kk);
                        const A = k.a2 + L3 * Math.sin(beta), B = L3 * Math.cos(beta), n = A * A + B * B;
                        const q2 = Math.atan2((A * r - B * h) / n, (B * r + A * h) / n);
                        const q3 = beta - q2 - PHI;
                        const M = mul(mul(tr(mul(Rz(q1), Ry(-q3))), R), tr(R_TOOL)); // Rx(-q4)Ry(-q5)Rx(-q6)
                        for (const flip of [false, true]) {
                                const sb = Math.hypot(M[1][0], M[2][0]) * (flip ? 1 : -1);
                                const b = Math.atan2(sb, M[0][0]);
                                let a, c;
                                if (Math.abs(sb) < 1e-9) { a = 0; c = Math.atan2(-M[1][2], M[1][1]); } // J5 = 0
                                else { a = Math.atan2(M[1][0] / sb, -M[2][0] / sb); c = Math.atan2(M[0][1] / sb, M[0][2] / sb); }
                                const q = [q1, q2, q3, -a, -b, -c].map(v => wrap(v / D2R));
                                const cfg = (q[4] > 0 ? "F" : "N") + (elbowUp(q, k) ? " U" : " D") + (front ? " T" : " B");
                                out.push({ q, cfg });
                        }
                }
        }
        return out;
}

// J3 limit checked on the relative elbow angle J2+J3 (URDF convention), see robot_spec.md 1.3
function inLimits(q, k = KIN) {
        const v = [q[0], q[1], q[1] + q[2], q[3], q[4], q[5]];
        return v.every((x, i) => x >= k.lim[i][0] && x <= k.lim[i][1]);
}


const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const lerp = (a,b,u) => a+(b-a)*u;
const plus = (a,b) => a.map((v,i)=>v+b[i]);
const minus = (a,b) => a.map((v,i)=>v-b[i]);
const scale = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0);
const distance = (a,b) => Math.hypot(...minus(a,b));
function worldToScene(p) { return [ROBOT.x-p[1]/1000, ROBOT.y+p[0]/1000, ROBOT.zJ2+p[2]/1000]; }
function sceneToWorld(p) { return [(p[1]-ROBOT.y)*1000,(ROBOT.x-p[0])*1000,(p[2]-ROBOT.zJ2)*1000]; }
function tcpFor(q) { const f=fk(q); return worldToScene(f.p.map((v,i)=>v+1000*UT1.z*f.R[i][2])); }
function flangeForTCP(p) { const R=Rx(Math.PI), w=sceneToWorld(p); return {R,p:w.map((v,i)=>v-1000*UT1.z*R[i][2])}; }
// Keep explicit winding choices for J4/J6; do not wrap a continuity difference across a joint stop.
function ik(pose,qPrev=HOME) {
  const candidates=[];
  for(const s of ikAll(pose)) for(const j4 of [-360,0,360]) for(const j6 of [-360,0,360]) {
    const q=[...s.q];q[3]+=j4;q[5]+=j6;
    if(inLimits(q)) candidates.push({q,cfg:s.cfg});
  }
  const nut=candidates.filter(s=>s.cfg==='N U T');
  const choices=nut.length?nut:candidates;
  choices.sort((a,b)=>a.q.reduce((n,v,i)=>n+(v-qPrev[i])**2,0)-b.q.reduce((n,v,i)=>n+(v-qPrev[i])**2,0));
  return choices[0]||null;
}
function mustTCP(p,prev) { const s=ik(flangeForTCP(p),prev); if(!s||s.cfg!=='N U T')throw Error('No N U T IK at '+JSON.stringify(p)); return s.q; }

const TP = [
 "1: UFRAME_NUM=1 ;", "2: UTOOL_NUM=1 ;", "3: PAYLOAD[1] ;", "4: DO[11:BUSY]=ON ;",
 "5: WAIT DI[1:DOOR_OK]=ON ;", "6: J PR[1:HOME] 100% FINE ;", "7: CALL GRIP_OPEN ;",
 "8: VISION RUN_FIND 'FIND_CYL' ;", "9: VISION GET_NFOUND 'FIND_CYL' R[1] ;", "10: IF R[1]<>10,JMP LBL[99] ;",
 "11: R[2:I]=0 ;", "12: LBL[1] ;", "13: R[2:I]=R[2:I]+1 ;", "14: VISION GET_OFFSET 'FIND_CYL' VR[1] JMP LBL[99] ;",
 "15: J P[1:PICK_APP] 80% CNT50 VOFFSET,VR[1] ;", "16: L P[2:PICK] 300mm/sec FINE VOFFSET,VR[1] ;",
 "17: CALL GRIP_CLOSE ;", "18: L P[1:PICK_APP] 500mm/sec CNT20 VOFFSET,VR[1] ;",
 "19: J PR[R[2]+20] 80% CNT50 Offset,PR[5:APP_Z] ;", "20: L PR[R[2]+20] 300mm/sec FINE ;",
 "21: CALL GRIP_OPEN ;", "22: L PR[R[2]+20] 500mm/sec CNT20 Offset,PR[5:APP_Z] ;",
 "23: IF R[2:I]<10,JMP LBL[1] ;", "24: J PR[1:HOME] 100% FINE ;", "25: DO[12:CYCLE_DONE]=PULSE,0.5sec ;",
 "26: DO[11:BUSY]=OFF ;", "[END] ;", "LBL[99] ;", "UALM[1] ;",
 "GRIP_CLOSE: RO[2:OPEN]=OFF ; RO[1:CLOSE]=ON ; WAIT RI[1:CLOSED]=ON TIMEOUT,LBL[99] ;",
 "GRIP_OPEN: RO[1:CLOSE]=OFF ; RO[2:OPEN]=ON ; WAIT RI[2:OPENED]=ON TIMEOUT,LBL[99] ;",
];
// Repeatable synthetic measurement error (metres), bounded by the radial hole clearance.
function visionOffset(k) { const v=[Math.sin((k+1)*2.1),Math.cos((k+1)*1.7),0];return scale(v,0.0004/Math.max(1,Math.hypot(...v))); }
const parts=HOLES.filter(h=>h.side==='A').map((h,k)=>({id:h.id,k,from:h.id,to:'B'+h.i,
  offset:visionOffset(k),track:[{t:0,mode:'fixed',p:plus([h.x,h.y,h.cz],visionOffset(k))}]}));
const program=[];
let planQ=[...HOME], planGrip=0;
function instruction(line,lane='io',duration=0.010,extra={}) {
  const a={kind:'wait',line,lane,duration,cmd:TP[line-1],label:TP[line-1],q0:[...planQ],q1:[...planQ],g0:planGrip,g1:planGrip,...extra};
  program.push(a);return a;
}
function move(line,p,kind,speed,cnt,extra={}) {
  const from=tcpFor(planQ),q0=[...planQ],q1=Array.isArray(p)&&p.length===6?[...p]:mustTCP(p,q0),to=tcpFor(q1);
  const a={kind,line,lane:'robot',cmd:TP[line-1],label:TP[line-1],q0,q1,from,to,speed,cnt,g0:planGrip,g1:planGrip,...extra};
  if(kind==='L') {
    a.path=[q0]; const n=Math.max(1,Math.ceil(distance(from,to)/0.001));
    for(let j=1;j<=n;j++)a.path.push(mustTCP(from.map((v,i)=>lerp(v,to[i],j/n)),a.path.at(-1)));
    a.q1=a.path.at(-1);
  }
  planQ=[...a.q1];program.push(a);return a;
}
function gripCommand(line,closed,k=null) {
  const a=instruction(line,'gripper',closed?0.35:0.30,{kind:'grip',k,g1:closed?1:0});planGrip=a.g1;return a;
}
for(const line of [1,2,3,4,5])instruction(line);
move(6,HOME,'J',1,false);gripCommand(7,false);
instruction(8,'vision',0.005,{kind:'snap',snap:true});instruction(8,'vision',0.350,{kind:'process',snap:true});
instruction(9,'vision',0.010,{found:10});instruction(10);instruction(11);
for(const p of parts) {
  const source=p.track[0].p,dest=HOLES.find(h=>h.id===p.to),target=[dest.x,dest.y,dest.cz];
  instruction(12);instruction(13);instruction(14,'vision',0.010,{kind:'offset',k:p.k,VR:[...source],noise:p.offset});
  move(15,plus(source,[0,0,APPROACH]),'J',0.8,true,{k:p.k,hole:p.from});
  move(16,source,'L',0.300,false,{k:p.k,hole:p.from});gripCommand(17,true,p.k);
  move(18,plus(source,[0,0,APPROACH]),'L',0.500,true,{k:p.k,hole:p.from});
  move(19,plus(target,[0,0,APPROACH]),'J',0.8,true,{k:p.k,hole:p.to});
  move(20,target,'L',0.300,false,{k:p.k,hole:p.to});gripCommand(21,false,p.k);
  move(22,plus(target,[0,0,APPROACH]),'L',0.500,true,{k:p.k,hole:p.to});instruction(23);
}
move(24,HOME,'J',1,false);instruction(25,'io',0.5,{kind:'pulse'});instruction(26);
// Time-optimal scalar trapezoid at the requested speed cap. base = max(|dq|/v) for J,
// or Cartesian distance/v for L. Acceleration ramps take 0.15/0.10 s to reach the cap.
// Short moves use triangular profiles. FINE ends at rest. CNT between adjacent motions
// retains 20% scalar speed, without geometric rounding; corners idealize controller blending.
// An intervening WAIT/vision/I/O instruction necessarily returns to rest, with no hidden dwell.
function motionProfile(base,acc,vi=0,vf=0) {
  if(base<1e-12)return {T:0.001,base:0,acc,vi:0,vf:0,peak:0,ta:0,tc:0,da:0,dc:0};
  const peak=Math.min(1,Math.sqrt(base/acc+(vi*vi+vf*vf)/2));
  const ta=(peak-vi)*acc,td=(peak-vf)*acc,da=(vi+peak)*ta/2,dd=(vf+peak)*td/2;
  const dc=Math.max(0,base-da-dd),tc=dc/peak;
  return {T:ta+tc+td,base,acc,vi,vf,peak,ta,tc,da,dc};
}
function motionFraction(p,t) {
  if(!p.base)return 1;t=clamp(t,0,p.T);let d;
  if(t<=p.ta)d=p.vi*t+t*t/(2*p.acc);
  else if(t<=p.ta+p.tc)d=p.da+(t-p.ta)*p.peak;
  else{const u=t-p.ta-p.tc;d=p.da+p.dc+p.peak*u-u*u/(2*p.acc);}
  return clamp(d/p.base,0,1);
}
const segs={robot:[],gripper:[],vision:[],io:[]};
let endTime=0;
program.forEach((a,i)=>{
  if(a.kind==='J'||a.kind==='L') {
    const base=a.kind==='J'?Math.max(...a.q1.map((v,j)=>Math.abs(v-a.q0[j])/(ROBOT.vmax[j]*a.speed))):distance(a.from,a.to)/a.speed;
    const moving=x=>x&&(x.kind==='J'||x.kind==='L');
    a.profile=motionProfile(base,a.kind==='J'?0.15:0.10,moving(program[i-1])&&program[i-1].cnt?0.2:0,moving(program[i+1])&&a.cnt?0.2:0);
    a.duration=a.profile.T;
  }
  a.t0=endTime;a.t1=endTime+a.duration;endTime=a.t1;
  for(const lane of Object.keys(segs))segs[lane].push(lane===a.lane?a:{...a,kind:'wait',lane,active:false,cmd:'',label:'Idle',snap:false});
});
const DURATION=endTime;
function segAt(list,t) { let lo=0,hi=list.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(list[mid].t0<=t)lo=mid;else hi=mid-1;}return list[lo]; }
function robotPose(t) {
  t=clamp(t,0,DURATION);const a=segAt(program,t),u=a.profile?motionFraction(a.profile,t-a.t0):clamp((t-a.t0)/a.duration,0,1);
  let q;
  if(a.kind==='J')q=a.q0.map((v,j)=>lerp(v,a.q1[j],u));
  else if(a.kind==='L') {
    const guess=a.path[Math.min(a.path.length-1,Math.round(u*(a.path.length-1)))];
    q=mustTCP(a.from.map((v,j)=>lerp(v,a.to[j],u)),guess);
  } else q=[...a.q0];
  return {q,grip:lerp(a.g0,a.g1,u),seg:a,tcp:tcpFor(q)};
}
function lineAt(t) { return segAt(program,clamp(t,0,DURATION)).line; }
function ioAt(t) {
  const a=segAt(program,clamp(t,0,DURATION));
  const close=program.filter(s=>s.kind==='grip'&&s.t0<=t).at(-1),complete=close&&t>=close.t1;
  return {DI:{'1:DOOR_OK':1},DO:{'11:BUSY':t>=program.find(s=>s.line===4).t0&&t<program.at(-1).t0?1:0,'12:CYCLE_DONE':a.line===25?1:0},
    RI:{'1:CLOSED':complete&&close.g1===1?1:0,'2:OPENED':!close||complete&&close.g1===0?1:0},
    RO:{'1:CLOSE':close&&close.g1===1?1:0,'2:OPEN':!close||close.g1===0?1:0}};
}
// Dense traces include exact grip/release instants, so the existing mesh consumer can interpolate p.
// The cylinder centre is the grasp TCP; its bottom is topZ-holeD (12 mm insertion), not half-depth.
const RATE=30;
for(const p of parts) {
  const pick=program.find(a=>a.line===17&&a.k===p.k),drop=program.find(a=>a.line===21&&a.k===p.k);
  p.pick=pick.t1;p.place=drop.t1;
  p.track.push({t:p.pick,mode:'robot',p:robotPose(p.pick).tcp});
  for(let t=p.pick+1/RATE;t<p.place;t+=1/RATE)p.track.push({t,mode:'robot',p:robotPose(t).tcp});
  const h=HOLES.find(h=>h.id===p.to);p.track.push({t:p.place,mode:'fixed',p:[h.x,h.y,h.cz]});
  p.track.push({t:DURATION,mode:'fixed',p:[h.x,h.y,h.cz]});
}

// Static obstacle dimensions mirror PLAN §3/§7 and the current visual builders. [E] cell geometry.
// All listed obstacle classes are enabled. Worktop/board contact and robot self-collision are
// outside this capsule clearance model; the independent low-tool corridor check covers insertion.
const CELL_BOUNDS={x:[-0.51,0.51],y:[-0.34,0.52],roof:0.96};
const obstacles=[];
function obstacleBox(name,lo,hi){obstacles.push({name,type:'box',lo,hi});}
for(const x of [-0.53,0.53])for(const y of [-0.36,0.54])obstacleBox(`post ${x}/${y}`,[x-0.02,y-0.02,-0.80],[x+0.02,y+0.02,1.02]);
for(const z of [-0.80,-0.55,0,1]) {
  for(const y of [-0.36,0.54])obstacleBox(`x beam ${y}/${z}`,[-0.55,y-0.02,z-0.02],[0.55,y+0.02,z+0.02]);
  for(const x of [-0.53,0.53])obstacleBox(`y beam ${x}/${z}`,[x-0.02,-0.38,z-0.02],[x+0.02,0.56,z+0.02]);
}
for(const [axis,bound,sign,name] of [[0,-0.51,1,'left panel'],[0,0.51,-1,'right panel'],[1,-0.34,1,'front door'],[1,0.52,-1,'rear panel'],[2,0.96,-1,'roof panel']])obstacles.push({name,type:'plane',axis,bound,sign});
const CAMERA={x:-0.10,y:-0.08,lensZ:0.876-CAMERA_DROP};
obstacleBox('camera body',[CAMERA.x-0.023,CAMERA.y-0.023,CAMERA.lensZ+0.035],[CAMERA.x+0.023,CAMERA.y+0.023,CAMERA.lensZ+0.095]);
obstacleBox('camera lens/ring',[CAMERA.x-0.024,CAMERA.y-0.024,CAMERA.lensZ-0.003],[CAMERA.x+0.024,CAMERA.y+0.024,CAMERA.lensZ+0.035]);
obstacleBox('camera drop bracket',[CAMERA.x-0.020,CAMERA.y-0.020,CAMERA.lensZ+0.095],[CAMERA.x+0.020,CAMERA.y+0.020,1.020]);
obstacleBox('camera roof support',[CAMERA.x-0.020,-0.34,0.98],[CAMERA.x+0.020,0.52,1.02]);
obstacleBox('calibration grid',[0.23,-0.32,0],[0.43,-0.12,0.003]);
obstacleBox('controller',[-0.485,-0.175,-0.55],[-0.115,0.175,-0.35]);
// Additional Euro box/pendant bounds below the worktop, retained rather than silently excluded.
obstacleBox('Euro box',[0.08,-0.15,-0.55],[0.48,0.15,-0.33]);
function robotCapsules(q) {
  const a=q.map(v=>v*D2R),c=Math.cos(a[0]),s=Math.sin(a[0]);
  const shoulder=worldToScene([0,0,0]);
  const e=[KIN.a2*Math.sin(a[1])*c,KIN.a2*Math.sin(a[1])*s,KIN.a2*Math.cos(a[1])];
  const j4=plus(e,[-KIN.a3*Math.sin(a[2])*c,-KIN.a3*Math.sin(a[2])*s,KIN.a3*Math.cos(a[2])]);
  const f=fk(q),w=f.p.map((v,i)=>v-KIN.d6*f.R[i][2]),tool=d=>worldToScene(f.p.map((v,i)=>v+1000*d*f.R[i][2]));
  return [
    {name:'shoulder',a:[ROBOT.x,ROBOT.y,0.169],b:shoulder,r:0.095},
    {name:'upper arm',a:shoulder,b:worldToScene(e),r:0.063},
    {name:'elbow housing',a:worldToScene(e),b:worldToScene(j4),r:0.075},
    {name:'forearm',a:worldToScene(j4),b:worldToScene(w),r:0.055},
    {name:'wrist',a:worldToScene(w),b:worldToScene(f.p),r:0.037},
    {name:'gripper body',a:tool(0.015),b:tool(0.060),r:0.0375},
    {name:'gripper fingers',a:tool(0.075),b:tool(UT1.z),r:0.016},
  ];
}
// Exact segment-to-AABB Euclidean distance: each slab crossing partitions a quadratic.
function segmentBoxDistance(a,b,lo,hi) {
  const d=minus(b,a),cuts=[0,1];
  for(let i=0;i<3;i++)if(Math.abs(d[i])>1e-15)for(const edge of [lo[i],hi[i]]){const t=(edge-a[i])/d[i];if(t>0&&t<1)cuts.push(t);}
  cuts.sort((x,y)=>x-y);let best=Infinity;
  const sq=t=>a.reduce((n,v,i)=>{const p=v+d[i]*t;return n+(p<lo[i]?p-lo[i]:p>hi[i]?p-hi[i]:0)**2;},0);
  for(let j=0;j<cuts.length-1;j++) {
    const l=cuts[j],h=cuts[j+1],mid=(l+h)/2;let A=0,B=0;
    for(let i=0;i<3;i++){const p=a[i]+d[i]*mid,edge=p<lo[i]?lo[i]:p>hi[i]?hi[i]:null;if(edge!==null){A+=d[i]**2;B+=d[i]*(a[i]-edge);}}
    best=Math.min(best,sq(l),sq(h),sq(A?clamp(-B/A,l,h):mid));
  }
  return Math.sqrt(best);
}
function clearances(q) {
  const caps=robotCapsules(q);
  return obstacles.map(o=>{
    let m=Infinity,link='';
    for(const c of caps){const d=(o.type==='plane'?Math.min(o.sign*(c.a[o.axis]-o.bound),o.sign*(c.b[o.axis]-o.bound)):segmentBoxDistance(c.a,c.b,o.lo,o.hi))-c.r;if(d<m){m=d;link=c.name;}}
    return {m,obstacle:o.name,link};
  });
}
function lowToolSafe(pose) {
  const low=robotCapsules(pose.q).filter(c=>c.name==='wrist'||c.name.startsWith('gripper')).some(c=>Math.min(c.a[2],c.b[2])-c.r<BOARD.topZ+0.040-1e-9);
  if(!low)return true;
  const a=pose.seg,vertical=a.kind==='L'&&Math.hypot(a.to[0]-a.from[0],a.to[1]-a.from[1])<1e-8;
  // Insertion corridor includes the required stationary grip dwell and its vertical withdrawal.
  // It never permits low joint transfers; final 60 mm is measured from the grasp centre.
  if(!vertical&&a.kind!=='grip')return false;
  const h=HOLES.find(h=>h.id===(a.hole||(a.line===17?parts[a.k]?.from:parts[a.k]?.to)));
  return !!h&&Math.hypot(pose.tcp[0]-h.x,pose.tcp[1]-h.y)<0.0006&&pose.tcp[2]<=h.cz+0.060+1e-9&&pose.tcp[2]>=h.cz-1e-8;
}
const sampleTimes=[...new Set([0,DURATION,...Array.from({length:Math.ceil(DURATION*RATE)},(_,i)=>Math.min(DURATION,i/RATE)),...program.flatMap(a=>[a.t0,a.t1])])].sort((a,b)=>a-b);
const S={t:[],q:[],tcp:[],grip:[],cl:[],safe:[],line:[]};
const minClear={m:Infinity,at:0,obstacle:'',link:'',byObstacle:obstacles.map(o=>({obstacle:o.name,m:Infinity,at:0,link:''}))};
let ikFail=0;
for(const t of sampleTimes) {
  const pose=robotPose(t),cs=clearances(pose.q);
  S.t.push(t);S.q.push(pose.q);S.tcp.push(pose.tcp);S.grip.push(pose.grip);S.cl.push(cs.map(c=>c.m));S.safe.push(lowToolSafe(pose));S.line.push(pose.seg.line);
  for(let j=0;j<cs.length;j++){const c=cs[j];if(c.m<minClear.byObstacle[j].m)minClear.byObstacle[j]={...c,at:t};if(c.m<minClear.m)Object.assign(minClear,c,{at:t});}
}
const peakV=ROBOT.vmax.map(()=>0);
for(let i=1;i<S.t.length;i++){const dt=S.t[i]-S.t[i-1];if(dt<1e-9)continue;S.q[i].forEach((v,j)=>{peakV[j]=Math.max(peakV[j],Math.abs(v-S.q[i-1][j])/dt);});}
console.log('[fanuc] cycle',DURATION.toFixed(3),'s; clearance',(minClear.m*1000).toFixed(2),'mm;',minClear.obstacle,'/',minClear.link);
// @@logic-end

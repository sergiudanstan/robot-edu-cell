// Native pure-JS checks of the generated HTML. Usage: node tests/run.mjs [file.html] [--perturb|--perturb2]
// --perturb moves the camera down 400 mm; --perturb2 removes the 80 mm approaches.
// 300 mm stays 53 mm clear of the 4S envelope over this board. 400 mm intersects.
// Exit 0 = valid baseline, 1 = detected model violations, 2 = invalid input/ineffective negative probe.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const args=process.argv.slice(2),perturb=args.includes('--perturb'),perturb2=args.includes('--perturb2');
if(perturb&&perturb2){console.error('Run each negative probe separately');process.exit(2);}
const file=args.find(a=>!a.startsWith('--'))||join(dirname(fileURLToPath(import.meta.url)),'..','index.html');
const html=readFileSync(file,'utf8'),match=html.match(/\/\/ @@logic-start[^\n]*\n([\s\S]*?)\/\/ @@logic-end/);
if(!match){console.error('Missing pure logic block');process.exit(2);}
let code=match[1];
function replaceOnce(a,b){if(code.split(a).length!==2)throw Error('Missing/ambiguous perturbation target: '+a);code=code.replace(a,b);}
let L;
try {
  if(perturb)replaceOnce('const CAMERA_DROP = 0;','const CAMERA_DROP = 0.40;');
  if(perturb2)replaceOnce('const APPROACH = 0.080;','const APPROACH = 0;');
  L=new Function('console',code+'\nreturn {BOARD,HOLES,KIN,ROBOT,HOME,UT1,UF1,APPROACH,CAMERA_DROP,CAMERA,TP,parts,program,segs,DURATION,S,minClear,peakV,obstacles,fk,ik,ikAll,inLimits,tcpFor,robotPose,ioAt,lineAt,lowToolSafe,segmentBoxDistance,worldToScene,sceneToWorld,clearances};')({log(){}});
} catch(e){console.error('Logic evaluation failed:',e.stack);process.exit(2);}
let fails=0;const kinds=new Set();
const check=(ok,msg,kind='model')=>{console.log(`${ok?'PASS':'FAIL'}  ${msg}`);if(!ok){fails++;kinds.add(kind);}};
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
check(dist(L.fk([0,0,0,0,0,0]).p,[360,0,280])<1e-8,'4S zero-pose flange matches the reference (WORLD mm)');
check(dist(L.worldToScene([290,0,210]),[0.20,0.41,0.54])<1e-10,'WORLD to scene conversion and J2 datum');
check(L.UT1.z===0.125&&dist(L.UF1.p,[L.BOARD.x-0.13,L.BOARD.y-0.08,0.020])<1e-10,'UT1 125 mm and UF1 front-left board corner');
check(!L.inLimits([0,120,100,0,-90,0])&&L.inLimits(L.HOME),'coupled J2+J3 limit is enforced');
let roundtrip=0,rotationError=0,maxSolutions=0;
for(let n=0;n<120;n++) {
  const q=[150*Math.sin(n*1.1),40+55*Math.sin(n*0.7),-20+30*Math.cos(n*0.9),80*Math.sin(n),-60+35*Math.cos(n*0.8),150*Math.cos(n*0.3)];
  if(!L.inLimits(q))continue;
  const f=L.fk(q),sol=L.ik(f,q);checkSolution(sol);
  const all=L.ikAll(f);maxSolutions=Math.max(maxSolutions,all.length);
  for(const s of all){const r=L.fk(s.q);roundtrip=Math.max(roundtrip,dist(f.p,r.p));rotationError=Math.max(rotationError,...f.R.flat().map((v,i)=>Math.abs(v-r.R.flat()[i])));}
  function checkSolution(s){if(!s||!L.inLimits(s.q)){roundtrip=Infinity;return;}roundtrip=Math.max(roundtrip,dist(f.p,L.fk(s.q).p));}
}
check(maxSolutions===8&&roundtrip<1e-6&&rotationError<1e-8,`IK branches: up to ${maxSolutions}; FK round trip ${roundtrip.toExponential(2)} mm`);
check(L.S.q.length>600&&L.S.t.length===L.S.q.length&&L.S.q.every(q=>q.every(Number.isFinite)&&L.inLimits(q)),`${L.S.q.length} samples: finite IK, all joint limits`);
const continuity=L.S.q.every((q,i)=>!i||L.S.t[i]-L.S.t[i-1]<1e-9||q.every((v,j)=>Math.abs(v-L.S.q[i-1][j])/(L.S.t[i]-L.S.t[i-1])<=L.ROBOT.vmax[j]+1e-5));
check(continuity,`IK continuity / peak speeds: ${L.peakV.map(v=>v.toFixed(1)).join(' / ')} deg/s`);
let maxTCP=0,maxOrientation=0;
for(const a of L.program.filter(a=>a.kind==='L'))for(const f of [0,0.25,0.5,0.75,1]) {
  const p=L.robotPose(a.t0+(a.t1-a.t0)*f),r=L.fk(p.q).R;
  const d=a.to.map((v,i)=>v-a.from[i]),norm=d.reduce((n,v)=>n+v*v,0),u=norm?p.tcp.reduce((n,v,i)=>n+(v-a.from[i])*d[i],0)/norm:0;
  maxTCP=Math.max(maxTCP,dist(p.tcp,a.from.map((v,i)=>v+u*d[i])));
  maxOrientation=Math.max(maxOrientation,Math.abs(r[0][2]),Math.abs(r[1][2]),Math.abs(r[2][2]+1));
}
check(maxTCP<1e-8&&maxOrientation<1e-8,'L moves stay Cartesian, tool vertical, with per-pose IK');
for(const [lane,list] of Object.entries(L.segs))check(list.length>0&&list[0].t0===0&&list.every((s,i)=>s.t1>s.t0&&(!i||Math.abs(s.t0-list[i-1].t1)<1e-10))&&Math.abs(list.at(-1).t1-L.DURATION)<1e-10,`${lane}: contiguous segments through cycle end`);
check(L.program.every(a=>Number.isInteger(a.line)&&L.TP[a.line-1]===a.cmd),'each segment identifies its exact TP statement');
const first=L.program.find(a=>a.kind==='J'||a.kind==='L'),door=L.program.find(a=>a.line===5);
check(door&&door.t1<=first.t0&&L.ioAt(first.t0).DI['1:DOOR_OK']===1,'DOOR_OK checked before first motion');
check(L.program.filter(a=>a.line===16).every(p=>L.program.some(v=>v.kind==='offset'&&v.k===p.k&&v.t1<=p.t0)),'every pick has its own preceding GET_OFFSET');
check(L.parts.length===10&&new Set(L.parts.map(p=>p.to)).size===10,'ten distinct source/destination cylinders');
let traceError=0,seatError=0;
for(const p of L.parts) {
  const h=L.HOLES.find(h=>h.id===p.to),end=p.track.at(-1);
  seatError=Math.max(seatError,dist(end.p,[h.x,h.y,L.BOARD.topZ-L.BOARD.holeD+L.BOARD.cylH/2]));
  for(const k of p.track)if(k.mode==='robot')traceError=Math.max(traceError,dist(k.p,L.robotPose(k.t).tcp));
}
check(seatError<1e-9&&L.parts.every(p=>p.place<L.DURATION),`all cylinders seated exactly in B1–B10; error ${(seatError*1000).toFixed(6)} mm`);
check(traceError<1e-9,'carried traces follow the gripper TCP at every recorded sample');
check(L.parts.every(p=>Math.hypot(...p.offset)<=0.0004+1e-12),'deterministic vision offsets stay within ±0.4 mm and hole clearance');
check(L.program.filter(a=>a.kind==='snap').every(a=>Math.abs(a.duration-0.005)<1e-9)&&L.program.filter(a=>a.kind==='process').every(a=>Math.abs(a.duration-0.35)<1e-9),'vision: 5 ms snap + 350 ms processing, LED active');
check(L.program.filter(a=>a.kind==='grip').every(a=>Math.abs(a.duration-(a.g1?0.35:0.30))<1e-9&&L.ioAt(a.t1).RI[a.g1?'1:CLOSED':'2:OPENED']===1),'gripper timings and RI acknowledgements');
const pulse=L.program.find(a=>a.line===25);
check(Math.abs(pulse.duration-0.5)<1e-10&&L.ioAt(pulse.t0+0.25).DO['12:CYCLE_DONE']===1&&L.ioAt(L.DURATION).DO['11:BUSY']===0,'cycle-done pulse and BUSY reset');
// Independent analytic probes of the native distance primitive (no wrapper summary).
check(Math.abs(L.segmentBoxDistance([-2,0,0],[2,0,0],[-1,-1,-1],[1,1,1]))<1e-12&&Math.abs(L.segmentBoxDistance([-2,2,0],[2,2,0],[-1,-1,-1],[1,1,1])-1)<1e-12,'segment/AABB: known intersection and known 1 m separation');
check(L.obstacles.length>=30&&L.S.cl.every(v=>v.length===L.obstacles.length&&v.every(Number.isFinite)),`all ${L.obstacles.length} obstacles checked at every sample (no disabled categories)`);
const minimum=Math.min(...L.S.cl.flat());
check(Number.isFinite(L.minClear.m)&&Math.abs(minimum-L.minClear.m)<1e-12&&minimum>=0.025,`minimum clearance ${(minimum*1000).toFixed(2)} mm at ${L.minClear.at.toFixed(3)} s: ${L.minClear.link} / ${L.minClear.obstacle}`,'collision');
const badLow=L.S.safe.filter(x=>!x).length;
check(badLow===0,`low-tool insertion corridor: ${badLow} violations`,'descent');
check(L.DURATION>=20&&L.DURATION<=90,`cycle ${L.DURATION.toFixed(3)} s (20–90 s)`);
console.log(`\nNode ${process.version}; ${L.S.t.length} samples; ${L.parts.length} cylinders; ${fails} failed check(s)`);
if((perturb&&!kinds.has('collision'))||(perturb2&&!kinds.has('descent'))){console.error('INEFFECTIVE NEGATIVE PROBE: required '+(perturb?'camera collision':'low-tool violation')+' was not detected; verification incomplete.');process.exit(2);}
process.exit(fails?1:0);

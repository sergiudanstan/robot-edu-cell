// Independent URDF / GLB / published-logic audit. No project dependencies or browser.
// Run: node tests/robot_geometry.mjs [--perturb]
// --perturb adds 5 mm to joint_3's origin in memory. Exit: 0 pass, 1 findings, 2 incomplete check.
// Bounding-box and frame checks establish plausibility, NOT exact surface equivalence to original CAD.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.some(a=>a!=='--perturb')){console.error('Usage: node tests/robot_geometry.mjs [--perturb]');process.exit(2);}
const perturb=args.includes('--perturb'),files={urdf:'_ref/robot_src/rosi_lrmate200id4s_macro.xacro',glb:'assets/lrmate200id4s.glb',html:'index.html'};
const sha=b=>createHash('sha256').update(b).digest('hex');
let failures=0;
function check(ok,message){console.log(`${ok?'PASS':'FAIL'} ${message}`);if(!ok)failures++;}
function requireValue(ok,message){if(!ok)throw Error(message);}
// Load pinned upstream ES modules in memory, including GLTFLoader's dependencies. No npm install.
const moduleBase='https://cdn.jsdelivr.net/npm/three@0.186.1/',moduleCache=new Map();
async function moduleURL(path){
  if(moduleCache.has(path))return moduleCache.get(path);
  const task=(async()=>{
    const response=await fetch(moduleBase+path,{signal:AbortSignal.timeout(30000)});
    requireValue(response.ok,`Cannot load three@0.186.1/${path}: HTTP ${response.status}`);
    let source=await response.text();
    const imports=[...new Set([...source.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/^\s*(?:import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+)|export\s+(?:\{[^}]*\}|\*))\s+from\s*['"]([^'"]+)['"]/gm)].map(m=>m[1]))];
    for(const spec of imports){
      const absolute=spec==='three'?moduleBase+'build/three.module.js':spec.startsWith('three/addons/')?moduleBase+'examples/jsm/'+spec.slice(13):new URL(spec,moduleBase+path).href;
      requireValue(absolute.startsWith(moduleBase),`Unexpected module dependency: ${spec}`);
      const url=await moduleURL(absolute.slice(moduleBase.length));
      source=source.replaceAll(`'${spec}'`,`'${url}'`).replaceAll(`"${spec}"`,`"${url}"`);
    }
    return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  })();moduleCache.set(path,task);return task;
}
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:.-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1],m[2]]));
const tag=(body,name)=>{const m=body.match(new RegExp(`<${name}\\b([^>]*)\\/?>`));return m?attrs(m[1]):null;};
const clean=s=>s?.replaceAll('${prefix}','');
function scalar(s){
  if(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(s))return Number(s);
  let m=s.match(/^\$\{radians\(([-+\d.]+)\)\}$/);if(m)return Number(m[1])*Math.PI/180;
  m=s.match(/^\$\{(-?)pi(?:\/([\d.]+))?\}$/);if(m)return (m[1]?-1:1)*Math.PI/(m[2]?Number(m[2]):1);
  throw Error('Unsupported xacro numeric expression: '+s);
}
function vector(s){const a=(s||'0 0 0').match(/\$\{[^}]+\}|[^\s]+/g).map(scalar);requireValue(a.length===3&&a.every(Number.isFinite),'Invalid xyz/rpy: '+s);return a;}
function parseURDF(text){
  text=text.replace(/<!--[\s\S]*?-->/g,'');
  const joints=new Map(),links=new Map();
  for(const m of text.matchAll(/<joint\b([^>]*)>([\s\S]*?)<\/joint>/g)){
    const a=attrs(m[1]),origin=tag(m[2],'origin'),limit=tag(m[2],'limit'),name=clean(a.name);
    requireValue(!joints.has(name),'Duplicate URDF joint '+name);
    const j={name,type:a.type,parent:clean(tag(m[2],'parent')?.link),child:clean(tag(m[2],'child')?.link),xyz:vector(origin?.xyz),rpy:vector(origin?.rpy),axis:vector(tag(m[2],'axis')?.xyz)};
    requireValue(j.parent&&j.child,`Missing parent/child of ${name}`);
    if(j.type==='revolute'){requireValue(limit&&tag(m[2],'axis'),`Missing axis/limits of ${name}`);j.limits=[scalar(limit.lower),scalar(limit.upper)];}
    else requireValue(j.type==='fixed','Unsupported joint type '+j.type);
    joints.set(name,j);
  }
  for(const m of text.matchAll(/<link\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/link>)/g)){
    const name=clean(attrs(m[1]).name),visual=m[2]?.match(/<visual\b[^>]*>([\s\S]*?)<\/visual>/)?.[1],origin=visual&&tag(visual,'origin');
    requireValue(!links.has(name),'Duplicate URDF link '+name);
    links.set(name,{name,visual:visual?{xyz:vector(origin?.xyz),rpy:vector(origin?.rpy),mesh:tag(visual,'mesh')?.filename,scale:tag(visual,'mesh')?.scale?vector(tag(visual,'mesh').scale):[1,1,1]}:null});
  }
  return {joints,links};
}
try {
  const inputs=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,readFileSync(resolve(root,p))]));
  const hashes=Object.fromEntries(Object.entries(inputs).map(([k,b])=>[k,sha(b)]));
  console.log(`Node ${process.version}; three 0.186.1; ${perturb?'PERTURBED joint_3 origin z +5 mm':'baseline'}; seed 0x4fac2026`);
  console.log('SHA256 '+Object.entries(hashes).map(([k,v])=>`${k}=${v}`).join(' '));
  const {joints,links}=parseURDF(inputs.urdf.toString());
  const chain=Array.from({length:6},(_,i)=>joints.get('joint_'+(i+1)));
  requireValue(chain.every(Boolean)&&joints.has('base_link-base')&&joints.has('link_6-flange')&&joints.has('flange-tool0'),'Incomplete URDF main/base/tool chain');
  requireValue(chain.every((j,i)=>j.parent===(i?'link_'+i:'base_link')&&j.child==='link_'+(i+1)),'Unexpected URDF chain connectivity');
  if(perturb)chain[2].xyz[2]+=0.005;
  const dimensions=[['J2 height',chain[0].xyz,[0,0,0.330]],['J2 offset',chain[1].xyz,[0,0,0]],['upper arm',chain[2].xyz,[0,0,0.260]],['J3 offset',chain[3].xyz,[0,0,0.020]],['forearm',chain[4].xyz,[0.290,0,0]],['J5 to flange',chain[5].xyz,[0.070,0,0]]];
  for(const [name,actual,expected] of dimensions){const mm=actual.map(v=>v*1000),error=Math.hypot(...actual.map((v,i)=>v-expected[i]))*1000;check(error<=1+1e-9,`${name}: xyz [${mm.map(v=>v.toFixed(3))}] mm; deviation ${error.toFixed(3)} mm (<=1)`);}
  const expectedAxes=[[0,0,1],[0,1,0],[0,-1,0],[-1,0,0],[0,-1,0],[-1,0,0]];
  check(chain.every((j,i)=>j.axis.every((v,k)=>Math.abs(v-expectedAxes[i][k])<1e-12)&&j.rpy.every(v=>Math.abs(v)<1e-12)),`URDF axes ${chain.map(j=>'['+j.axis+']').join(' ')}; zero origin rotations`);
  const THREE=await import(await moduleURL('build/three.module.js'));
  const {GLTFLoader}=await import(await moduleURL('examples/jsm/loaders/GLTFLoader.js'));
  requireValue(THREE.REVISION==='186','Incorrect three revision');
  const buffer=inputs.glb.buffer.slice(inputs.glb.byteOffset,inputs.glb.byteOffset+inputs.glb.byteLength);
  const gltf=await new Promise((yes,no)=>new GLTFLoader().parse(buffer,'',yes,no));
  gltf.scene.updateMatrixWorld(true);
  const originMatrix=j=>new THREE.Matrix4().compose(new THREE.Vector3(...j.xyz),new THREE.Quaternion().setFromEuler(new THREE.Euler(...j.rpy,'ZYX')),new THREE.Vector3(1,1,1));
  const names=['base_link',...chain.map(j=>j.child)];
  // These broad engineering envelopes come from the joint spans + housing radii, not GLB accessors.
  // Bounds are in each URDF link's frame. Castings overlap joint centres: link_2 bbox is NOT 260 mm.
  const envelopes={
    base_link:{lo:[-0.150,-0.120,-0.001],hi:[0.110,0.130,0.190],minSize:[0.150,0.150,0.150]},
    link_1:{lo:[-0.125,-0.110,-0.180],hi:[0.125,0.110,0.080],minSize:[0.100,0.150,0.150]},
    link_2:{lo:[-0.110,-0.110,-0.080],hi:[0.110,0.110,0.340],minSize:[0.090,0.100,0.260]},
    link_3:{lo:[-0.100,-0.090,-0.090],hi:[0.090,0.090,0.100],minSize:[0.090,0.080,0.080]},
    link_4:{lo:[-0.010,-0.070,-0.070],hi:[0.350,0.070,0.080],minSize:[0.220,0.070,0.070]},
    link_5:{lo:[-0.055,-0.050,-0.055],hi:[0.085,0.050,0.055],minSize:[0.070,0.050,0.050]},
    link_6:{lo:[-0.020,-0.023,-0.023],hi:[0.001,0.023,0.023],minSize:[0.004,0.038,0.038]},
  };
  const boxes=new Map();
  for(const name of names){
    const found=[];gltf.scene.traverse(o=>{if(o.name===name)found.push(o);});
    check(found.length===1,`${name}: exactly one named link (${found.length})`);
    if(found.length!==1)continue;
    const object=found[0],visual=links.get(name)?.visual;requireValue(visual?.mesh,`Missing URDF visual for ${name}`);
    // This GLB is a parts library: its link roots must not contain assembled robot transforms.
    const expected=originMatrix(visual).scale(new THREE.Vector3(...visual.scale));
    const transformError=Math.max(...object.matrixWorld.elements.map((v,i)=>Math.abs(v-expected.elements[i])));
    const bbox=new THREE.Box3();let vertices=0,triangles=0,finite=true;
    object.traverse(o=>{
      if(!o.isMesh)return;
      const a=o.geometry.attributes.position,idx=o.geometry.index;requireValue(a&&a.itemSize===3,`No position buffer in ${name}`);
      const count=idx?idx.count:a.count;requireValue(count%3===0,`Invalid triangle count in ${name}`);
      for(let i=0;i<count;i++){const n=idx?idx.getX(i):i;requireValue(Number.isInteger(n)&&n>=0&&n<a.count,`Invalid index in ${name}`);}
      for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i);finite&&=[p.x,p.y,p.z].every(Number.isFinite);p.applyMatrix4(o.matrixWorld);bbox.expandByPoint(p);}
      vertices+=a.count;triangles+=count/3;
    });
    const lo=bbox.min.toArray(),hi=bbox.max.toArray(),size=bbox.getSize(new THREE.Vector3()).toArray(),e=envelopes[name];boxes.set(name,bbox);
    const plausible=vertices>0&&triangles>0&&finite&&lo.every((v,i)=>v>=e.lo[i]-1e-6)&&hi.every((v,i)=>v<=e.hi[i]+1e-6)&&size.every((v,i)=>v>=e.minSize[i]-1e-6);
    check(transformError<1e-8&&plausible,`${name}: frame error ${transformError.toExponential(2)}; bbox mm [${lo.map(v=>(v*1000).toFixed(2))}]..[${hi.map(v=>(v*1000).toFixed(2))}]; ${triangles} triangles`);
  }
  if(boxes.has('link_2')){const b=boxes.get('link_2');check(b.min.z<0&&b.max.z>=chain[2].xyz[2]&&b.max.z<=chain[2].xyz[2]+0.080,'link_2 spans J2 at z=0 and J3 at z=260 mm, plus end housings');}
  if(boxes.has('link_6'))check(Math.abs(boxes.get('link_6').max.x)<0.001,'link_6 flange face is at local x=0 (<=1 mm)');
  const logic=inputs.html.toString().match(/\/\/ @@logic-start[^\n]*\n([\s\S]*?)\/\/ @@logic-end/);
  requireValue(logic,'index.html has no logic block');
  const L=runInNewContext(logic[1]+'\n;({fk,inLimits})',{console:{log(){}}},{timeout:10000});
  // ROS base_link->base is FANUC WORLD. ROS tool0, not the unrotated ROS flange,
  // has FANUC's orientation. Both fixed transforms are read from URDF, never copied from fk().
  const baseJoint=joints.get('base_link-base'),flangeJoint=joints.get('link_6-flange'),toolJoint=joints.get('flange-tool0');
  requireValue(baseJoint.parent==='base_link'&&baseJoint.child==='base'&&flangeJoint.parent==='link_6'&&flangeJoint.child==='flange'&&toolJoint.parent==='flange'&&toolJoint.child==='tool0','Invalid fixed-frame chain');
  const baseInverse=originMatrix(baseJoint).invert();
  function urdfFK(q){
    const angles=[q[0],q[1],q[1]+q[2],q[3],q[4],q[5]].map(v=>v*Math.PI/180),T=new THREE.Matrix4();
    chain.forEach((j,i)=>{const axis=new THREE.Vector3(...j.axis);requireValue(Math.abs(axis.length()-1)<1e-10,`Non-unit axis ${j.name}`);T.multiply(originMatrix(j));T.multiply(new THREE.Matrix4().makeRotationAxis(axis,angles[i]));});
    T.multiply(originMatrix(flangeJoint)).multiply(originMatrix(toolJoint));return baseInverse.clone().multiply(T);
  }
  let seed=0x4fac2026;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const poses=Array.from({length:200},()=>{const u=chain.map(j=>(j.limits[0]+(j.limits[1]-j.limits[0])*random())*180/Math.PI);return[u[0],u[1],u[2]-u[1],u[3],u[4],u[5]];});
  requireValue(poses.every(q=>L.inLimits(q)),'URDF generated poses outside published logic limits');
  let worstMM=0,worstRotation=0,worstIndex=-1;
  for(const [i,q] of poses.entries()){
    const T=urdfFK(q),f=L.fk(q),p=new THREE.Vector3().setFromMatrixPosition(T).multiplyScalar(1000);
    const mm=p.distanceTo(new THREE.Vector3(...f.p));requireValue(Number.isFinite(mm),'Non-finite FK position');
    if(mm>worstMM){worstMM=mm;worstIndex=i;}
    for(let r=0;r<3;r++)for(let c=0;c<3;c++){const error=Math.abs(T.elements[c*4+r]-f.R[r][c]);requireValue(Number.isFinite(error),'Non-finite FK orientation');worstRotation=Math.max(worstRotation,error);}
  }
  check(worstMM<=0.5,`200 deterministic FK poses: max ${worstMM.toPrecision(9)} mm (<=0.5), sample ${worstIndex}`);
  check(worstRotation<=1e-9,`axis signs / FANUC tool orientation: matrix error ${worstRotation.toExponential(3)}; mapping [J1,J2,J2+J3,J4,J5,J6]`);
  if(perturb)requireValue(worstMM>0.5,'Ineffective perturbation: FK did not detect 5 mm joint_3 origin shift');
  // Detect another worker rewriting the actual inputs during the audit.
  for(const [key,path] of Object.entries(files))requireValue(sha(readFileSync(resolve(root,path)))===hashes[key],`${path} changed during verification; rerun`);
  console.log(`RESULT: ${failures} failed checks; ${perturb?'5 mm origin probe detected':'all required geometry/frame/FK checks completed'}.`);
  console.log('Scope: link-frame and bounding-envelope sanity, not CAD surface identity or collision/manufacturing validation.');
  process.exitCode=failures?1:0;
} catch(error){console.error('INCOMPLETE: '+String(error.message).split('data:')[0].slice(0,1200));process.exitCode=2;}

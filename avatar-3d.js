// A small, articulated human avatar built from local geometry. No network or
// model downloads are required; every material and joint stays on this device.
import * as THREE from './assets/vendor/three/three.module.min.js';

const instances = new WeakMap();
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = value => value * value * (3 - 2 * value);
const lerp = (a, b, amount) => a + (b - a) * amount;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const defaults = Object.freeze({
  skin:'#D9A17B', top:'#247B65', bottom:'#344E48', hairColor:'#302B29',
  hair:'bob', accessory:'none', outfit:'casual', pose:'idle', scene:'mint',
  heightCm:165, weightKg:60, sex:'f'
});
const themes = {
  mint:{background:'#EDF5EE', floor:'#DCEBDE', rim:'#B9D5C1', fill:'#BCE9D7', key:'#FFF4DF'},
  sunset:{background:'#FAEEE5', floor:'#EEDAC6', rim:'#DDBA99', fill:'#FFD9C0', key:'#FFF1DE'},
  lavender:{background:'#F0EDF7', floor:'#E3DCEE', rim:'#C4B4DA', fill:'#D9C7F7', key:'#FFF6EE'},
  night:{background:'#172B2C', floor:'#294143', rim:'#416465', fill:'#94C8D7', key:'#EBF1E8'}
};
const lengths = {wave:2.8, cheer:3.2, stretch:4.6};
const choices = {
  hair:['short','bob','long','curl','buzz'],
  accessory:['none','glasses','cap','headphones'],
  outfit:['hoodie','sport','casual','explorer'],
  pose:['idle','wave','cheer','stretch'],
  scene:Object.keys(themes)
};

function normalize(previous, patch = {}) {
  const result = {...previous};
  for (const key of ['skin','top','bottom','hairColor']) {
    if (typeof patch[key] === 'string' && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(patch[key])) result[key] = patch[key];
  }
  for (const [key, values] of Object.entries(choices)) if (values.includes(patch[key])) result[key] = patch[key];
  for (const [key, min, max] of [['heightCm',130,215],['weightKg',30,220]]) {
    const value = Number(patch[key]);
    if (own(patch, key) && Number.isFinite(value)) result[key] = clamp(value, min, max);
  }
  if (['m','f','male','female'].includes(patch.sex)) result.sex = patch.sex.startsWith('m') ? 'm' : 'f';
  return result;
}

function buildHuman() {
  const turntable = new THREE.Group();
  const proportions = new THREE.Group(); turntable.add(proportions);
  const rig = new THREE.Group(); proportions.add(rig);
  const standard = (color, roughness = .86) => new THREE.MeshStandardMaterial({color, roughness, metalness:0});
  const materials = {
    skin:standard(defaults.skin, .83), skinShade:standard('#C58D69'),
    top:standard(defaults.top), bottom:standard(defaults.bottom),
    hair:standard(defaults.hairColor, .95), hairLight:standard('#453B35'),
    ink:standard('#233A36', .75), iris:standard('#4C7569', .55),
    white:standard('#FFF9EF'), glint:new THREE.MeshBasicMaterial({color:'#FFFFFF'}),
    cheek:standard('#DD9B8C'), mouth:standard('#6A443D'),
    sole:standard('#F4F0E4'), shoe:standard('#D4DFD4'),
    trim:standard('#BBD8C5'), lens:new THREE.MeshPhysicalMaterial({color:'#D7EAE0',roughness:.18,transparent:true,opacity:.13,depthWrite:false})
  };
  const sphere = new THREE.SphereGeometry(1, 22, 16);
  const capsule = new THREE.CapsuleGeometry(1, 1, 5, 12);
  const torus = new THREE.TorusGeometry(1, .095, 8, 32);
  const capGeometry = new THREE.SphereGeometry(1, 24, 14, 0, TAU, 0, 1.30);
  const body = (parent, name, material, position, scale, geometry = sphere) => {
    const mesh = new THREE.Mesh(geometry, materials[material]);
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const pill = (parent, name, material, position, radius, length) => body(parent, name, material, position, [radius,length/3,radius], capsule);
  const tube = (parent, name, points, radius, material) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 7, false), materials[material]);
    mesh.name = name; mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  const group = (parent, name) => {const value = new THREE.Group(); value.name = name; parent.add(value); return value;};

  const torso = group(rig, 'torso'); torso.position.y = 1.75;
  body(torso, 'shirt-body', 'top', [0,-.05,0], [.425,.49,.285]);
  pill(rig, 'neck', 'skin', [0,2.17,0], .125, .28);
  const collar = body(torso, 'collar', 'trim', [0,.355,.018], [.155,.155,.15], torus); collar.rotation.x = Math.PI/2;
  const outfits = {};
  for (const name of choices.outfit) outfits[name] = group(torso, name);
  body(outfits.casual, 'tee-pocket', 'top', [-.17,.04,.276], [.09,.105,.024]);
  tube(outfits.casual, 'pocket-stitch', [[-.245,.105,.293],[-.17,.09,.304],[-.095,.105,.293]], .007, 'trim');
  body(outfits.casual, 'tee-hem', 'top', [0,-.43,0], [.354,.065,.25]);

  body(outfits.hoodie, 'hoodie-body', 'top', [0,-.08,0], [.455,.49,.313]);
  body(outfits.hoodie, 'folded-hood', 'top', [0,.30,-.115], [.335,.23,.27]);
  body(outfits.hoodie, 'hood-inner', 'bottom', [0,.385,-.095], [.21,.075,.19]);
  body(outfits.hoodie, 'kangaroo-pocket', 'top', [0,-.24,.298], [.245,.13,.052]);
  tube(outfits.hoodie, 'pocket-seam', [[-.21,-.20,.333],[0,-.30,.356],[.21,-.20,.333]], .008, 'trim');
  for (const side of [-1,1]) {
    tube(outfits.hoodie, 'drawstring', [[side*.10,.29,.23],[side*.12,.13,.303],[side*.135,.01,.31]], .012, 'white');
    pill(outfits.hoodie, 'drawstring-tip', 'white', [side*.135,-.005,.316], .016, .058);
  }
  body(outfits.hoodie, 'hoodie-hem', 'top', [0,-.44,0], [.38,.065,.27]);

  for (const side of [-1,1]) {
    tube(outfits.sport, 'jersey-side', [[side*.32,.19,.19],[side*.335,-.10,.22],[side*.29,-.39,.23]], .025, 'white');
  }
  body(outfits.sport, 'jersey-badge', 'white', [-.15,.12,.27], [.055,.065,.014]);
  for (let i=0;i<3;i++) {
    const mark = pill(outfits.sport, 'jersey-mark', 'trim', [-.07+i*.065,-.09+i*.015,.288], .012, .12);
    mark.rotation.z = -.5;
  }

  body(outfits.explorer, 'jacket-body', 'top', [0,-.07,0], [.46,.49,.315]);
  tube(outfits.explorer, 'jacket-zip', [[0,.29,.28],[0,-.06,.328],[0,-.43,.255]], .012, 'bottom');
  body(outfits.explorer, 'zip-pull', 'white', [0,.19,.323], [.022,.035,.014]);
  for (const side of [-1,1]) {
    body(outfits.explorer, 'jacket-pocket', 'top', [side*.23,-.18,.298], [.13,.15,.045]);
    body(outfits.explorer, 'pocket-flap', 'bottom', [side*.23,-.065,.324], [.135,.034,.025]);
    body(outfits.explorer, 'snap', 'white', [side*.23,-.073,.348], [.012,.012,.01]);
    const lapel = body(outfits.explorer, 'jacket-collar', 'top', [side*.105,.31,.145], [.105,.16,.095]);
    lapel.rotation.z = -side*.28;
  }

  const head = group(rig, 'head'); head.position.set(0,2.60,0);
  body(head, 'face', 'skin', [0,.13,0], [.525,.58,.435]);
  for (const side of [-1,1]) {
    body(head, 'ear', 'skin', [side*.514,.12,-.015], [.085,.14,.073]);
    body(head, 'inner-ear', 'skinShade', [side*.546,.12,.046], [.033,.075,.018]);
  }
  const eyes = [], pupils = [];
  for (const side of [-1,1]) {
    const eye = group(head, side<0?'left-eye':'right-eye'); eye.position.set(side*.192,.205,.389); eyes.push(eye);
    body(eye, 'eye-white', 'white', [0,0,0], [.108,.136,.052]);
    const pupil = group(eye, 'gaze'); pupils.push(pupil);
    body(pupil, 'iris', 'iris', [side*.008,-.008,.044], [.075,.096,.023]);
    body(pupil, 'pupil', 'ink', [side*.008,-.004,.063], [.047,.067,.013]);
    body(pupil, 'eye-glint', 'glint', [-.024,.037,.078], [.022,.026,.009]);
    body(pupil, 'eye-glint-small', 'glint', [.03,-.039,.077], [.009,.011,.006]);
    tube(head, 'brow', [[side*.305,.386,.343],[side*.205,.413,.386],[side*.107,.389,.399]], .018, 'hair');
    body(head, 'cheek', 'cheek', [side*.315,-.055,.344], [.073,.031,.014]);
  }
  body(head, 'nose', 'skinShade', [0,.015,.435], [.047,.061,.058]);
  const smile = group(head, 'smile');
  tube(smile, 'smile-line', [[-.105,-.105,.393],[0,-.153,.428],[.105,-.105,.393]], .014, 'mouth');
  body(smile, 'lower-lip', 'cheek', [0,-.17,.415], [.047,.012,.01]);

  const hairstyles = {};
  for (const name of choices.hair) hairstyles[name] = group(head, name+'-hair');
  const hairCap = (parent, scale = [.55,.61,.458]) => body(parent, 'hair-crown', 'hair', [0,.13,-.016], scale, capGeometry);
  const fringe = (parent, alternate = false) => {
    for (const [i,x] of [-.29,-.10,.10,.28].entries()) {
      const lock = body(parent, 'fringe', 'hair', [x,.49-(alternate?i*.021:Math.abs(x)*.07),.285], [.19,.17,.14]);
      lock.rotation.z = alternate ? -.25 : x*.7;
    }
  };
  hairCap(hairstyles.short); fringe(hairstyles.short, true);
  body(hairstyles.short, 'back-hair', 'hair', [0,.19,-.20], [.48,.49,.29]);
  hairCap(hairstyles.bob); fringe(hairstyles.bob);
  body(hairstyles.bob, 'bob-back', 'hair', [0,.03,-.18], [.555,.62,.32]);
  for (const side of [-1,1]) body(hairstyles.bob, 'bob-side', 'hair', [side*.47,-.01,-.035], [.12,.49,.25]);
  hairCap(hairstyles.long); fringe(hairstyles.long, true);
  body(hairstyles.long, 'long-back', 'hair', [0,-.24,-.22], [.55,.94,.31]);
  for (const side of [-1,1]) {
    const lock = body(hairstyles.long, 'long-side', 'hair', [side*.47,-.34,.015], [.105,.65,.18]);
    lock.rotation.z = side*.07;
  }
  hairCap(hairstyles.curl, [.55,.60,.455]);
  for (let band=0;band<3;band++) {
    const theta = .38+band*.42;
    for (let i=0;i<12;i++) {
      const phi = i/12*TAU+band*.22;
      const x=Math.sin(theta)*Math.cos(phi)*.51, y=.13+Math.cos(theta)*.59, z=Math.sin(theta)*Math.sin(phi)*.43;
      body(hairstyles.curl, 'curl', i%5===0?'hairLight':'hair', [x,y,z], [.145,.14,.14]);
    }
  }
  for (const side of [-1,1]) for (let i=0;i<4;i++) body(hairstyles.curl, 'side-curl', 'hair', [side*.49,.29-i*.105,-.04], [.12,.12,.15]);
  const buzz=hairCap(hairstyles.buzz, [.548,.608,.455]); buzz.position.z=.004;

  const accessories = {};
  for (const name of choices.accessory) accessories[name] = group(head, name);
  const glasses = accessories.glasses;
  for (const side of [-1,1]) {
    body(glasses, 'glasses-frame', 'ink', [side*.194,.205,.461], [.128,.118,.10], torus);
    body(glasses, 'lens', 'lens', [side*.194,.205,.461], [.119,.109,.01]);
    tube(glasses, 'glasses-arm', [[side*.31,.22,.459],[side*.48,.23,.27],[side*.51,.20,.035]], .012, 'ink');
  }
  tube(glasses, 'glasses-bridge', [[-.065,.21,.467],[0,.233,.49],[.065,.21,.467]], .012, 'ink');
  body(accessories.cap, 'cap-crown', 'top', [0,.34,-.035], [.57,.45,.48], capGeometry);
  body(accessories.cap, 'cap-brim', 'top', [0,.455,.33], [.47,.045,.35]);
  body(accessories.cap, 'cap-badge', 'trim', [0,.57,.405], [.065,.06,.013]);
  tube(accessories.headphones, 'headphone-band', [[-.565,.17,0],[-.52,.60,0],[0,.77,0],[.52,.60,0],[.565,.17,0]], .036, 'bottom');
  for (const side of [-1,1]) {
    body(accessories.headphones, 'ear-pad', 'ink', [side*.56,.13,-.008], [.09,.18,.16]);
    body(accessories.headphones, 'ear-cup', 'top', [side*.625,.13,-.008], [.035,.147,.126]);
    body(accessories.headphones, 'ear-cup-trim', 'trim', [side*.657,.13,.015], [.012,.07,.059]);
  }

  const arms=[], elbows=[], wrists=[], shortSleeves=[], longSleeves=[];
  const legs=[], knees=[], ankles=[], shinMeshes=[], cargoPockets=[];
  for (const side of [-1,1]) {
    const arm = group(rig, side<0?'left-shoulder':'right-shoulder');
    arm.position.set(side*.40,2.02,0); arms.push(arm);
    pill(arm, 'upper-arm', 'skin', [0,-.205,0], .103, .44);
    shortSleeves.push(pill(arm, 'short-sleeve', 'top', [0,-.10,0], .125, .285));
    longSleeves.push(pill(arm, 'upper-long-sleeve', 'top', [0,-.205,0], .123, .45));
    const elbow=group(arm, 'elbow'); elbow.position.y=-.39; elbows.push(elbow);
    pill(elbow, 'forearm', 'skin', [0,-.16,0], .083, .37);
    longSleeves.push(pill(elbow, 'long-sleeve', 'top', [0,-.14,0], .108, .35));
    const wrist=group(elbow, 'wrist'); wrist.position.set(0,-.335,.012); wrists.push(wrist);
    body(wrist, 'palm', 'skin', [0,-.045,.007], [.089,.108,.052]);
    for (let i=0;i<3;i++) {
      const finger=pill(wrist, 'finger', 'skin', [-.055+i*.052,-.138,.012], .022, .105);
      finger.rotation.z = (i-1)*.10;
    }
    const thumb=pill(wrist, 'thumb', 'skin', [side*.094,-.045,.022], .029, .12); thumb.rotation.z=side*.62;

    const leg=group(rig, side<0?'left-hip':'right-hip'); leg.position.set(side*.195,1.25,0); legs.push(leg);
    pill(leg, 'thigh', 'bottom', [0,-.22,0], .155, .54);
    const knee=group(leg, 'knee'); knee.position.y=-.45; knees.push(knee);
    shinMeshes.push(body(knee, 'knee', 'bottom', [0,0,0], [.124,.13,.124]));
    shinMeshes.push(pill(knee, 'shin', 'bottom', [0,-.205,0], .118, .49));
    const cargo=body(leg, 'cargo-pocket', 'bottom', [side*.12,-.22,.06], [.065,.13,.12]); cargoPockets.push(cargo);
    const ankle=group(knee, 'ankle'); ankle.position.set(0,-.46,.015); ankles.push(ankle);
    body(ankle, 'sock', 'white', [0,.02,0], [.102,.11,.10]);
    body(ankle, 'sneaker', 'shoe', [0,-.13,.08], [.155,.13,.245]);
    body(ankle, 'sneaker-sole', 'sole', [0,-.225,.095], [.162,.044,.25]);
    body(ankle, 'shoe-accent', 'top', [side*.12,-.12,.02], [.035,.068,.13]);
    for (let i=0;i<2;i++) tube(ankle, 'lace', [[-.09,-.035,.13-i*.06],[0,-.012,.155-i*.06],[.09,-.035,.13-i*.06]], .009, 'white');
  }
  return {turntable,proportions,rig,torso,head,eyes,pupils,smile,arms,elbows,wrists,legs,knees,ankles,shortSleeves,longSleeves,shinMeshes,cargoPockets,hairstyles,accessories,outfits,materials,shape:1};
}

function applyConfig(model, config) {
  const {materials} = model;
  materials.skin.color.set(config.skin);
  materials.skinShade.color.set(config.skin).lerp(new THREE.Color('#795444'), .13);
  materials.cheek.color.set(config.skin).lerp(new THREE.Color('#E78F91'), .25);
  materials.top.color.set(config.top); materials.bottom.color.set(config.bottom);
  materials.hair.color.set(config.hairColor);
  materials.hairLight.color.set(config.hairColor).lerp(new THREE.Color('#D6B89A'), .13);
  materials.trim.color.set(config.top).lerp(new THREE.Color('#FFF7E8'), .55);
  materials.shoe.color.set(config.outfit==='explorer'?config.bottom:'#D4DFD4');
  for (const [key,value] of Object.entries(model.hairstyles)) {
    value.visible=key===config.hair;
    value.scale.setScalar(config.accessory==='cap'&&key!=='buzz'?.965:1);
    value.traverse(part=>{if(part.name==='fringe')part.visible=config.accessory!=='cap';});
  }
  for (const [key,value] of Object.entries(model.accessories)) value.visible=key===config.accessory;
  for (const [key,value] of Object.entries(model.outfits)) value.visible=key===config.outfit;
  model.shortSleeves.forEach(mesh=>{mesh.visible=config.outfit==='casual';});
  model.longSleeves.forEach(mesh=>{mesh.visible=['hoodie','explorer'].includes(config.outfit);});
  model.shinMeshes.forEach(mesh=>{mesh.material=config.outfit==='sport'?materials.skin:materials.bottom;});
  model.cargoPockets.forEach(mesh=>{mesh.visible=config.outfit==='explorer';});
  const bmi=config.weightKg/((config.heightCm/100)**2);
  model.shape=clamp(1+(bmi-22)*.014,.88,1.23)*(config.sex==='m'?1.035:.985);
  model.torso.scale.x=model.shape;
  model.torso.scale.z=clamp(model.shape,.94,1.13);
  model.arms.forEach((arm,i)=>{arm.position.x=(i?1:-1)*.40*model.shape;});
  model.legs.forEach((leg,i)=>{leg.position.x=(i?1:-1)*.195*clamp(model.shape,.92,1.15);});
  model.proportions.scale.y=clamp(config.heightCm/170,.88,1.10);
}

function pose(model, time, action='idle', progress=0, look={x:0,y:0}) {
  const {rig,torso,head,eyes,pupils,arms,elbows,wrists,legs,knees,ankles}=model;
  rig.position.y=Math.sin(time*1.7)*.006; rig.rotation.set(0,0,0);
  torso.scale.y=1+Math.sin(time*2.1)*.012;
  head.rotation.set(look.y*.08+Math.sin(time*1.3)*.015,look.x*.13,Math.sin(time*1.1)*.018);
  model.smile.scale.y=1;
  const phase=time%5.3;
  const blink=phase>5.05?Math.max(.065,Math.abs((phase-5.175)/.125)):1;
  eyes.forEach(eye=>{eye.scale.y=blink;});
  pupils.forEach(pupil=>{pupil.position.set(look.x*.018,-look.y*.015,0);});
  for (let i=0;i<2;i++) {
    const side=i?1:-1;
    arms[i].rotation.set(Math.sin(time*1.6+i)*.035,0,side*(.13+Math.sin(time*1.7)*.018));
    elbows[i].rotation.set(-.10,0,side*.025);
    wrists[i].rotation.set(0,0,Math.sin(time*1.9)*.025);
    legs[i].rotation.set(0,0,side*.018);
    knees[i].rotation.set(0,0,0); ankles[i].rotation.set(0,0,0);
  }
  if (action==='idle') return;
  const envelope=smooth(clamp(Math.min(progress/.18,(1-progress)/.19),0,1));
  if (action==='wave') {
    arms[1].rotation.z=lerp(.13,2.20,envelope);
    arms[1].rotation.x=-.08*envelope;
    elbows[1].rotation.z=(.32+Math.sin(progress*TAU*3)*.18)*envelope;
    wrists[1].rotation.z=Math.sin(progress*TAU*3)*.30*envelope;
    head.rotation.z-=envelope*.065;
  } else if (action==='cheer') {
    const hop=Math.abs(Math.sin(progress*TAU*2))*envelope;
    rig.position.y+=hop*.11;
    for (let i=0;i<2;i++) {
      const side=i?1:-1;
      arms[i].rotation.z=side*lerp(.13,2.65,envelope);
      elbows[i].rotation.z=side*.23*envelope;
      wrists[i].rotation.z=side*Math.sin(progress*TAU*2)*.12*envelope;
      knees[i].rotation.x=hop*.10;
    }
    model.smile.scale.y=1+envelope*.18;
  } else if (action==='stretch') {
    const lean=Math.sin(progress*TAU)*envelope;
    rig.rotation.z=lean*.085;
    head.rotation.z-=lean*.035;
    for (let i=0;i<2;i++) {
      const side=i?1:-1;
      arms[i].rotation.z=side*lerp(.13,2.93,envelope);
      elbows[i].rotation.z=-side*.18*envelope;
      wrists[i].rotation.z=-side*.22*envelope;
    }
  }
}

/** Mount one persistent avatar. update() recolors/reuses the existing rig.
 * play('wave'|'cheer'|'stretch'|'idle') plays once and settles back to idle.
 * With reduced motion, selected poses are displayed as still frames instead.
 */
export function mountAvatar(host, initialConfig={}) {
  if (!host || typeof host.appendChild!=='function') return null;
  if (instances.has(host)) {const instance=instances.get(host); instance.update(initialConfig); return instance;}
  let renderer;
  try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}
  catch {host.dataset.renderer='fallback';host.dataset.animation='paused';return null;}
  const canvas=renderer.domElement;
  canvas.dataset.avatarCanvas=''; canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-2.1,2.1,2.1,-2.1,.1,30);
  camera.position.set(.10,2.75,8); camera.lookAt(0,1.61,0);
  const ambient=new THREE.HemisphereLight('#FFFDF2','#A5B8A9',2.35); scene.add(ambient);
  const key=new THREE.DirectionalLight('#FFF4DF',3.1); key.position.set(-3.5,6,5);
  key.castShadow=true; key.shadow.mapSize.set(512,512); key.shadow.normalBias=.028; key.shadow.bias=-.0004; key.shadow.radius=3;
  Object.assign(key.shadow.camera,{left:-2.2,right:2.2,top:4,bottom:-1,near:.1,far:15});
  key.target.position.set(0,1.5,0); scene.add(key,key.target);
  const fill=new THREE.DirectionalLight('#BCE9D7',1.25); fill.position.set(3.5,3,-3); scene.add(fill);
  const model=buildHuman(); scene.add(model.turntable);
  const floorMaterial=new THREE.MeshBasicMaterial({color:'#EDF5EE',toneMapped:false});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),floorMaterial); floor.rotation.x=-Math.PI/2; floor.position.y=-.012; scene.add(floor);
  const pedestalMaterial=new THREE.MeshStandardMaterial({color:'#DCEBDE',roughness:.9});
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(1.02,1.06,.075,48),pedestalMaterial);
  pedestal.position.y=.028; pedestal.receiveShadow=true; scene.add(pedestal);
  const rimMaterial=new THREE.MeshStandardMaterial({color:'#B9D5C1',roughness:.9});
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1.035,.013,8,64),rimMaterial); rim.rotation.x=-Math.PI/2; rim.position.y=.067; scene.add(rim);

  let config=normalize(defaults,initialConfig);
  let disposed=false,lost=false,inView=true,active=false,frame=0,lastWall=0,lastDraw=0,time=0;
  let action=null,started=0,staticPose='idle',yaw=-.13,targetYaw=-.13,pitch=0,targetPitch=0;
  let pointerId=null,pointerStart=null,dragging=false;
  const look={x:0,y:0};
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const previous={tabindex:host.getAttribute('tabindex'),role:host.getAttribute('role'),label:host.getAttribute('aria-label'),shortcuts:host.getAttribute('aria-keyshortcuts')};
  if (previous.tabindex===null) host.tabIndex=0;
  if (previous.role===null) host.setAttribute('role','img');
  if (previous.label===null) host.setAttribute('aria-label','ตัวละคร 3 มิติ ลากซ้ายขวาเพื่อหมุน หรือใช้ปุ่มลูกศร กด Space เพื่อทักทาย');
  host.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown Home Space');
  host.appendChild(canvas); host.dataset.renderer='webgl';

  function draw(still=false) {
    if (disposed||lost) return;
    const name=still?staticPose:(action||'idle');
    pose(model,still?0:time,name,still&&name!=='idle'?.48:action?clamp((time-started)/lengths[action],0,1):0,look);
    model.turntable.rotation.y=yaw; model.turntable.rotation.x=pitch;
    renderer.render(scene,camera);
  }
  function tick(now) {
    frame=0;
    if (!active||disposed||lost||motion.matches) return;
    if (now-lastDraw>=1000/30) {
      time+=Math.min(lastWall?(now-lastWall)/1000:0,.1); lastWall=now; lastDraw=now;
      if (action&&time-started>=lengths[action]) action=null;
      yaw=lerp(yaw,targetYaw,.14); pitch=lerp(pitch,targetPitch,.14);
      look.x=lerp(look.x,clamp(-targetYaw*.15,-.6,.6),.08);
      host.dataset.animation=dragging?'rotate':action||'idle';
      draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    if (disposed) return;
    if (!host.isConnected) {dispose();return;}
    const style=getComputedStyle(host);
    active=inView&&!document.hidden&&!host.closest('[hidden],[aria-hidden="true"]')&&host.clientWidth>0&&host.clientHeight>0&&style.visibility!=='hidden'&&style.display!=='none';
    cancelAnimationFrame(frame); frame=0; lastWall=0;
    if (!active||lost) {host.dataset.animation='paused';return;}
    if (motion.matches) {yaw=targetYaw;pitch=targetPitch;draw(true);host.dataset.animation='paused';return;}
    frame=requestAnimationFrame(tick);
  }
  function resize() {
    if (disposed) return;
    const width=host.clientWidth||300,height=host.clientHeight||360,aspect=width/height;
    const halfHeight=aspect<.78?2.30:2.10;
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    if (active) draw(motion.matches);
    sync();
  }
  function play(name) {
    if (disposed||!choices.pose.includes(name)) return;
    staticPose=name; action=name==='idle'?null:name; started=time;
    sync();
  }
  function update(patch={}) {
    if (disposed) return;
    config=normalize(config,patch); applyConfig(model,config);
    const theme=themes[config.scene];
    scene.background=new THREE.Color(theme.background);
    floorMaterial.color.set(theme.background);pedestalMaterial.color.set(theme.floor);rimMaterial.color.set(theme.rim);
    key.color.set(theme.key);fill.color.set(theme.fill);
    ambient.groundColor.set(theme.floor);ambient.intensity=config.scene==='night'?1.8:2.35;
    if (own(patch,'pose')) {staticPose=config.pose;action=config.pose==='idle'?null:config.pose;started=time;}
    if (active) draw(motion.matches);
    sync();
  }
  function onDown(event) {
    if (event.button!==0&&event.pointerType==='mouse') return;
    pointerId=event.pointerId;pointerStart={x:event.clientX,y:event.clientY,yaw:targetYaw};dragging=false;
    host.focus({preventScroll:true});
  }
  function onMove(event) {
    if (event.pointerId!==pointerId||!pointerStart) return;
    const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;
    if (!dragging&&Math.abs(dx)>5&&Math.abs(dx)>Math.abs(dy)) {dragging=true;canvas.setPointerCapture?.(event.pointerId);canvas.style.cursor='grabbing';}
    if (!dragging) return;
    event.preventDefault();targetYaw=pointerStart.yaw+dx*.012;
    if (motion.matches) {yaw=targetYaw;if(active)draw(true);}
  }
  function onUp(event) {
    if (event.pointerId!==pointerId) return;
    const wasDragging=dragging;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointerId=null;pointerStart=null;dragging=false;canvas.style.cursor='grab';
    if (!wasDragging&&event.type==='pointerup') play('wave');
  }
  function onKey(event) {
    if (event.target!==host) return;
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home',' ','Spacebar'].includes(event.key)) return;
    event.preventDefault();
    if (event.key==='ArrowLeft') targetYaw-=.18;
    if (event.key==='ArrowRight') targetYaw+=.18;
    if (event.key==='ArrowUp') targetPitch=clamp(targetPitch-.045,-.13,.13);
    if (event.key==='ArrowDown') targetPitch=clamp(targetPitch+.045,-.13,.13);
    if (event.key==='Home') {targetYaw=-.13;targetPitch=0;}
    if ([' ','Spacebar'].includes(event.key)) {play('wave');return;}
    if (motion.matches) {yaw=targetYaw;pitch=targetPitch;if(active)draw(true);}
  }
  function contextLost(event) {event.preventDefault();lost=true;canvas.hidden=true;host.dataset.renderer='fallback';sync();}
  function contextRestored() {lost=false;canvas.hidden=false;host.dataset.renderer='webgl';resize();}
  const intersection=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;sync();},{threshold:0}):null;
  intersection?.observe(host);
  const sizes=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;sizes?.observe(host);
  const mutations=new MutationObserver(sync);
  mutations.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style','aria-hidden']});
  canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);
  canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);canvas.addEventListener('lostpointercapture',onUp);
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  host.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',sync);window.addEventListener('resize',resize);
  motion.addEventListener('change',sync);
  function dispose() {
    if (disposed) return;disposed=true;cancelAnimationFrame(frame);
    intersection?.disconnect();sizes?.disconnect();mutations.disconnect();
    canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);
    canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onUp);canvas.removeEventListener('lostpointercapture',onUp);
    canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
    host.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',sync);window.removeEventListener('resize',resize);motion.removeEventListener('change',sync);
    const geometries=new Set(),materials=new Set(Object.values(model.materials));
    scene.traverse(object=>{if(object.isMesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
    geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
    key.shadow.dispose();renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    for (const [attribute,value] of [['tabindex',previous.tabindex],['role',previous.role],['aria-label',previous.label],['aria-keyshortcuts',previous.shortcuts]]) {
      if(value===null)host.removeAttribute(attribute);else host.setAttribute(attribute,value);
    }
    host.dataset.renderer='fallback';host.dataset.animation='paused';instances.delete(host);
  }
  const api={update,play,dispose};instances.set(host,api);
  update(initialConfig);resize();
  return api;
}

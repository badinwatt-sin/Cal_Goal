// Beep is a real articulated WebGL character. All geometry and animation stay
// on the device; the original artwork remains the fallback without WebGL.
import * as THREE from './assets/vendor/three/three.module.min.js';

const TAU = Math.PI * 2;
const ease = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

function buildBeep() {
  const rig = new THREE.Group();
  const materials = {
    mint: new THREE.MeshPhysicalMaterial({color: 0x29c5a2, roughness: .43, clearcoat: .35}),
    trim: new THREE.MeshStandardMaterial({color: 0x118e7e, roughness: .5}),
    darkMint: new THREE.MeshStandardMaterial({color: 0x157c72, roughness: .65}),
    cloth: new THREE.MeshStandardMaterial({color: 0x36bda0, roughness: .88}),
    cream: new THREE.MeshStandardMaterial({color: 0xfff4df, roughness: .75}),
    face: new THREE.MeshPhysicalMaterial({color: 0xf7f4f3, roughness: .4, clearcoat: .2}),
    navy: new THREE.MeshPhysicalMaterial({color: 0x102845, roughness: .14, clearcoat: 1}),
    iris: new THREE.MeshStandardMaterial({color: 0x18637a, roughness: .3}),
    white: new THREE.MeshBasicMaterial({color: 0xffffff}),
    mouth: new THREE.MeshStandardMaterial({color: 0x61253c, roughness: .8}),
    pink: new THREE.MeshStandardMaterial({color: 0xff8597, roughness: .7}),
    cheek: new THREE.MeshStandardMaterial({color: 0x6cddc7, roughness: .65})
  };
  // Reuse geometry for every rounded piece instead of uploading separate meshes.
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const capsule = new THREE.CapsuleGeometry(1, 1, 6, 12);
  function ball(parent, name, mat, position, scale) {
    const m = new THREE.Mesh(sphere, materials[mat]);
    m.name = name; m.position.set(...position); m.scale.set(...scale);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function tube(parent, points, radius, mat) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 8, false), materials[mat]);
    m.castShadow = true; parent.add(m); return m;
  }
  function ring(parent, radius, thickness, mat, position, rotation = [0, 0, 0]) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 32), materials[mat]);
    m.position.set(...position); m.rotation.set(...rotation); m.castShadow = true; parent.add(m); return m;
  }
  function pill(parent, mat, position, radius, length) {
    const m = new THREE.Mesh(capsule, materials[mat]);
    // The shared capsule is three units tall, including both hemispheres.
    m.position.set(...position); m.scale.set(radius, length / 3, radius);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }

  const torso = new THREE.Group(); torso.name = 'torso'; torso.position.y = 1.32; rig.add(torso);
  ball(torso, 'hoodie', 'cloth', [0, .04, 0], [.64, .59, .44]);
  ball(torso, 'hoodie-hem', 'trim', [0, -.34, 0], [.52, .17, .37]);
  ring(torso, .35, .075, 'mint', [0, .51, 0], [Math.PI / 2, 0, 0]);
  ball(torso, 'pocket', 'mint', [0, -.12, .405], [.35, .20, .075]);
  tube(torso, [[-.26, -.04, .452], [0, -.13, .477], [.26, -.04, .452]], .012, 'trim');
  for (const s of [-1, 1]) {
    tube(torso, [[s * .16, .43, .34], [s * .18, .24, .436], [s * .22, .09, .46]], .026, 'cream');
    ball(torso, 'drawstring-tip', 'cream', [s * .22, .085, .46], [.035, .058, .034]);
  }
  for (let i = 0; i < 3; i++) {
    const logo = pill(torso, 'cream', [-.08 + i * .11, -.14 + i * .035, .49], .025, .17);
    logo.rotation.z = -.55;
  }

  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 2.02, 0); rig.add(head);
  ball(head, 'helmet', 'mint', [0, .43, 0], [.87, .79, .65]);
  const rim = ring(head, .65, .055, 'trim', [0, .43, .568]); rim.scale.set(1.13, 1.04, 1);
  ball(head, 'faceplate', 'face', [0, .43, .565], [.72, .635, .165]);
  for (const s of [-1, 1]) {
    ball(head, 'earcup', 'trim', [s * .86, .43, -.015], [.18, .29, .28]);
    ball(head, 'ear-pad', 'mint', [s * .98, .43, -.015], [.055, .235, .23]);
    ring(head, .17, .026, 'cream', [s * 1.012, .43, -.015], [0, Math.PI / 2, 0]);
  }
  const eyes = [], pupils = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * .265, .48, .716); head.add(eye); eyes.push(eye);
    ball(eye, 'eye', 'navy', [0, 0, 0], [.175, .218, .072]);
    const pupil = new THREE.Group(); eye.add(pupil); pupils.push(pupil);
    ball(pupil, 'iris', 'iris', [s * .018, -.032, .055], [.115, .14, .022]);
    ball(pupil, 'pupil', 'navy', [s * .018, -.01, .071], [.098, .139, .022]);
    ball(pupil, 'eye-glint', 'white', [-.048, .075, .08], [.052, .061, .018]);
    ball(pupil, 'eye-glint-small', 'white', [.054, -.072, .083], [.021, .025, .01]);
    tube(head, [[s * .41, .78, .676], [s * .28, .835, .699], [s * .16, .798, .703]], .022, 'navy');
    ball(head, 'cheek', 'cheek', [s * .445, .18, .695], [.095, .035, .017]);
  }
  const smile = new THREE.Shape();
  smile.moveTo(-.185, .045);
  smile.bezierCurveTo(-.07, -.005, .07, -.005, .185, .045);
  smile.bezierCurveTo(.145, -.21, -.145, -.21, -.185, .045);
  const mouth = new THREE.Mesh(new THREE.ShapeGeometry(smile, 20), materials.mouth);
  mouth.position.set(0, .16, .739); head.add(mouth);
  ball(head, 'tongue', 'pink', [.025, .039, .746], [.085, .038, .014]);
  const antenna = new THREE.Group(); antenna.position.set(0, 1.15, -.035); head.add(antenna);
  tube(antenna, [[0, 0, 0], [-.055, .16, 0], [-.11, .29, 0]], .042, 'trim');
  ball(antenna, 'antenna-tip', 'mint', [-.11, .31, 0], [.135, .135, .135]);
  ball(antenna, 'antenna-glint', 'white', [-.145, .357, .101], [.028, .031, .012]);

  const arms = [], elbows = [], wrists = [];
  const legs = [], knees = [], ankles = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = s < 0 ? 'left-shoulder' : 'right-shoulder';
    arm.position.set(s * .55, 1.67, 0); rig.add(arm); arms.push(arm);
    pill(arm, 'cloth', [0, -.18, 0], .165, .50);
    const elbow = new THREE.Group(); elbow.position.y = -.37; arm.add(elbow); elbows.push(elbow);
    pill(elbow, 'cloth', [0, -.12, 0], .145, .37);
    ring(elbow, .141, .025, 'cream', [0, -.255, 0], [Math.PI / 2, 0, 0]);
    ring(elbow, .14, .018, 'trim', [0, -.30, 0], [Math.PI / 2, 0, 0]);
    const wrist = new THREE.Group(); wrist.position.set(0, -.36, .015); elbow.add(wrist); wrists.push(wrist);
    ball(wrist, 'glove', 'mint', [0, -.04, 0], [.15, .175, .085]);
    for (let i = 0; i < 4; i++) {
      const finger = pill(wrist, 'mint', [-.104 + i * .067, -.195 - .025 * Math.sin(i * Math.PI / 3), .005], .031, .17);
      finger.rotation.z = (i - 1.5) * .16;
    }
    const thumb = pill(wrist, 'mint', [s * .17, -.03, .025], .046, .19); thumb.rotation.z = s * .8;

    const leg = new THREE.Group(); leg.name = s < 0 ? 'left-hip' : 'right-hip';
    leg.position.set(s * .265, .91, 0); rig.add(leg); legs.push(leg);
    pill(leg, 'darkMint', [0, -.11, 0], .17, .34);
    const knee = new THREE.Group(); knee.position.y = -.245; leg.add(knee); knees.push(knee);
    pill(knee, 'cream', [0, -.105, 0], .115, .32);
    const ankle = new THREE.Group(); ankle.position.set(0, -.26, .035); knee.add(ankle); ankles.push(ankle);
    ball(ankle, 'shoe', 'mint', [0, -.045, .07], [.22, .19, .31]);
    ball(ankle, 'sole', 'cream', [0, -.16, .085], [.23, .065, .32]);
    ball(ankle, 'shoe-toe', 'cream', [0, -.04, .29], [.17, .11, .105]);
    for (let i = 0; i < 2; i++) {
      tube(ankle, [[-.13, .05, .17 - i * .07], [0, .09, .20 - i * .07], [.13, .05, .17 - i * .07]], .022, 'cream');
    }
  }
  return {rig, torso, head, antenna, eyes, pupils, arms, elbows, wrists, legs, knees, ankles};
}

// Exported pose evaluation keeps every joint deterministic, including jump
// takeoff, bent knees in the air and the soft landing.
export function poseBeep(model, time, action = 'idle', progress = 0, look = {x: 0, y: 0}) {
  const {rig, torso, head, antenna, eyes, pupils, arms, elbows, wrists, legs, knees, ankles} = model;
  rig.position.set(0, 0, 0); rig.rotation.set(0, -.13, 0); rig.scale.set(1, 1, 1);
  torso.scale.set(1, 1 + Math.sin(time * 2.3) * .018, 1);
  head.rotation.set(Math.sin(time * 1.4) * .025 + look.y * .09, look.x * .16, Math.sin(time * 1.2) * .035);
  antenna.rotation.z = Math.sin(time * 2.5) * .065;
  const blinkPhase = time % 4.7;
  const blink = blinkPhase > 4.45 ? Math.max(.06, Math.abs((blinkPhase - 4.575) / .125)) : 1;
  eyes.forEach(eye => {eye.scale.y = blink;});
  pupils.forEach(pupil => {pupil.position.set(look.x * .021, -look.y * .02, 0);});
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    arms[i].rotation.set(Math.sin(time * 1.9 + i) * .075, 0, s * (.30 + Math.sin(time * 1.8) * .045));
    elbows[i].rotation.set(-.10, 0, s * .07);
    wrists[i].rotation.set(0, Math.sin(time * 1.7) * .06, 0);
    legs[i].rotation.set(0, 0, s * .055);
    knees[i].rotation.set(0, 0, 0); ankles[i].rotation.set(0, 0, 0);
  }
  if (action === 'wave') {
    const envelope = Math.min(1, progress / .18, (1 - progress) / .2);
    const amount = ease(Math.max(0, envelope));
    arms[1].rotation.z = mix(.3, 2.25, amount);
    elbows[1].rotation.z = (.30 + Math.sin(progress * TAU * 3) * .27) * amount;
    wrists[1].rotation.z = Math.sin(progress * TAU * 3) * .24 * amount;
    head.rotation.z -= amount * .09;
  } else if (action === 'walk') {
    const amount = Math.min(1, progress / .12, (1 - progress) / .12);
    const stride = Math.sin(progress * TAU * 3);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      legs[i].rotation.x = s * stride * .48 * amount;
      knees[i].rotation.x = Math.max(0, -s * stride) * .60 * amount;
      ankles[i].rotation.x = -s * stride * .12 * amount;
      arms[i].rotation.x = -s * stride * .52 * amount;
    }
    rig.position.y = Math.abs(Math.sin(progress * TAU * 3)) * .055 * amount;
    rig.rotation.y += Math.sin(progress * TAU) * .13;
    head.rotation.z *= .3;
  } else if (action === 'jump') {
    let height = 0, tuck = 0, squash = 0;
    if (progress < .20) squash = Math.sin(progress / .20 * Math.PI) * .13;
    else if (progress < .75) {
      const flight = (progress - .20) / .55;
      height = 4 * flight * (1 - flight) * .62;
      tuck = Math.sin(flight * Math.PI);
    } else squash = Math.sin((progress - .75) / .25 * Math.PI) * .10;
    rig.position.y = height - squash * .4;
    rig.scale.set(1 + squash * .35, 1 - squash, 1 + squash * .35);
    arms[0].rotation.z = -.3 - tuck * 1.9;
    arms[1].rotation.z = .3 + tuck * 1.9;
    legs[0].rotation.x = -.30 * tuck; legs[1].rotation.x = -.18 * tuck;
    knees.forEach(knee => {knee.rotation.x = tuck * .72 + squash;});
    head.rotation.z = Math.sin(progress * TAU) * .065;
    antenna.rotation.z += Math.sin(progress * TAU * 2) * .16;
  } else if (action === 'drag') {
    rig.rotation.z = -.10;
    arms[0].rotation.z = -.9; arms[1].rotation.z = .9;
    legs[0].rotation.x = Math.sin(time * 7) * .25;
    legs[1].rotation.x = -Math.sin(time * 7) * .25;
  }
}

export function mountBeep(host) {
  if (!host || host.querySelector('canvas')) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'low-power'});
  } catch {return null;}
  const root = host.closest('#beepRoot'), dock = host.closest('.beep-dock');
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth || 112, host.clientHeight || 146, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.92, 1.92, 2.50, -2.50, .1, 30);
  camera.position.set(.3, 2.8, 9); camera.lookAt(0, 1.92, 0);
  scene.add(new THREE.HemisphereLight(0xf2ffff, 0x7b9b90, 2.3));
  const key = new THREE.DirectionalLight(0xfff6e8, 3.3); key.position.set(-3, 6, 6);
  key.castShadow = true; key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -2; key.shadow.camera.right = 2;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
  key.shadow.normalBias = .035; key.shadow.bias = -.0005; key.shadow.radius = 3;
  key.target.position.set(0, 1.5, 0); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x7df3e7, 1.3); fill.position.set(3, 3, -2); scene.add(fill);
  const model = buildBeep(); scene.add(model.rig);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const fade = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  fade.addColorStop(0, 'rgba(13,45,38,.48)'); fade.addColorStop(1, 'rgba(13,45,38,0)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 128, 128);
  const contactTexture = new THREE.CanvasTexture(shadowCanvas);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), new THREE.MeshBasicMaterial({map: contactTexture, transparent: true, opacity: .65, depthWrite: false}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = .10; scene.add(ground);

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const look = {x: 0, y: 0}, targetLook = {x: 0, y: 0};
  const durations = {jump: 1.35, wave: 2.5, walk: 3.4};
  let frame = 0, disposed = false, lost = false, visible = false, lastFrame = 0, lastWall = 0;
  let time = 0, action = 'wave', started = 0, nextAction = 6, sequence = 0;
  host.appendChild(canvas); host.dataset.renderer = 'webgl';
  function draw() {
    const height = Math.max(0, model.rig.position.y);
    ground.material.opacity = .65 - height * .35;
    ground.scale.setScalar(1 + height * .3);
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0;
    if (disposed || !visible || lost || motion.matches) return;
    // Use elapsed active time, so switching back to the app never fast-forwards
    // through a jump. Cap at 30 fps to keep the floating character inexpensive.
    if (now - lastFrame >= 1000 / 30) {
      time += Math.min(lastWall ? (now - lastWall) / 1000 : 0, .1);
      lastWall = now; lastFrame = now;
      if (dock.classList.contains('dragging')) {
        action = null; nextAction = time + 3.5;
        poseBeep(model, time, 'drag', 0, look); host.dataset.animation = 'drag';
      } else {
        if (action && time - started >= durations[action]) {action = null; nextAction = time + 3.5;}
        if (!action && time >= nextAction) {
          action = ['jump', 'wave', 'walk'][sequence++ % 3]; started = time;
        }
        look.x = mix(look.x, targetLook.x, .1); look.y = mix(look.y, targetLook.y, .1);
        poseBeep(model, time, action || 'idle', action ? (time - started) / durations[action] : 0, look);
        host.dataset.animation = action || 'idle';
      }
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (disposed) return;
    if (!host.isConnected) {dispose(); return;}
    visible = !root.hidden && !document.hidden && !document.body.matches('.beep-open,.sheet-open,.cam-open');
    cancelAnimationFrame(frame); frame = 0; lastWall = 0;
    if (!visible || lost) {host.dataset.animation = 'paused'; return;}
    if (motion.matches) {
      poseBeep(model, 0); draw(); host.dataset.animation = 'paused'; return;
    }
    frame = requestAnimationFrame(tick);
  }
  function play(name) {
    if (disposed || lost || motion.matches || !durations[name]) return;
    if (action === 'jump' && time - started < durations.jump) return;
    action = name; started = time; sync();
  }
  const pointer = e => {
    if (e.pointerType === 'touch') return;
    const box = host.getBoundingClientRect();
    targetLook.x = THREE.MathUtils.clamp((e.clientX - box.left - box.width / 2) / 200, -1, 1);
    targetLook.y = THREE.MathUtils.clamp((e.clientY - box.top - box.height / 2) / 250, -1, 1);
  };
  const observer = new MutationObserver(records => {
    if (records.some(r => r.target === dock) && dock.classList.contains('waving')) play('wave');
    else sync();
  });
  observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
  observer.observe(root, {attributes: true, attributeFilter: ['hidden'], childList: true});
  observer.observe(dock, {attributes: true, attributeFilter: ['class']});
  const contextLost = e => {
    e.preventDefault(); lost = true; canvas.hidden = true;
    host.dataset.renderer = 'fallback'; sync();
  };
  const contextRestored = () => {
    lost = false; canvas.hidden = false; host.dataset.renderer = 'webgl'; sync();
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('pointermove', pointer, {passive: true});
  motion.addEventListener('change', sync);
  function dispose() {
    if (disposed) return; disposed = true;
    cancelAnimationFrame(frame); observer.disconnect();
    document.removeEventListener('visibilitychange', sync); document.removeEventListener('pointermove', pointer);
    motion.removeEventListener('change', sync);
    canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => {if (object.isMesh) {geometries.add(object.geometry); materials.add(object.material);}});
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    contactTexture.dispose(); key.shadow.dispose(); renderer.dispose(); canvas.remove(); host.dataset.renderer = 'fallback';
  }
  poseBeep(model, 0); draw(); sync();
  return {play, dispose};
}

// Minecraft zombie loader. The glb has no skin, but every body part is its own node
// with a pivot at the joint (Minecraft style rigid rig), so we rotate the nodes directly.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadZombie(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; m.map.needsUpdate = true; }
      m.alphaTest = Math.max(m.alphaTest || 0, 0.5);
    }
  });
  const get = n => model.getObjectByName(n);
  const parts = {
    body: get('body_15'), head: get('head_4'),
    armA: get('rightArm_7'), armB: get('leftArm_10'),
    legA: get('rightLeg_12'), legB: get('leftLeg_14')
  };
  for (const k in parts) if (!parts[k]) throw new Error('zombie node missing: ' + k);

  // wrapper so we can rotate / squash around the model center
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const turn = new THREE.Group(); turn.add(model);
  turn.rotation.y = Math.PI; // the glb faces -z, turn it to face the camera
  const root = new THREE.Group(); root.add(turn);
  root.updateMatrixWorld(true);

  // which arm / leg is on screen right when the zombie faces the camera (+z)
  const wx = o => o.getWorldPosition(new THREE.Vector3()).x;
  const armR = wx(parts.armA) > wx(parts.armB) ? parts.armA : parts.armB;
  const armL = armR === parts.armA ? parts.armB : parts.armA;
  const legR = wx(parts.legA) > wx(parts.legB) ? parts.legA : parts.legB;
  const legL = legR === parts.legA ? parts.legB : parts.legA;

  const rig = { head: parts.head, body: parts.body, armR, armL, legR, legL };
  const rest = {};
  for (const k in rig) rest[k] = { q: rig[k].quaternion.clone(), p: rig[k].position.clone(), s: rig[k].scale.clone() };
  return { root, model, rig, rest, size, center };
}

export function setupScene(canvas, { background = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: background === null });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  if (background !== null) scene.background = new THREE.Color(background);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 5, 4); scene.add(key);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
  const fit = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  addEventListener('resize', fit); fit();
  return { renderer, scene, camera, THREE };
}

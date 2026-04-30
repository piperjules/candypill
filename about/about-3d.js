/**
 * Self-hosted Three.js + Draco (no CDN dynamic import) so CSP / ad blockers
 * cannot block the 3D preview on production.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODEL_PATH = new URL('../assets/models/midnight-portrait-about.glb', import.meta.url).href;
const DRACO_PATH = new URL('../assets/vendor/draco/gltf/', import.meta.url).href;

const PORTRAIT_MAT = {
  color: 0x2a3f6f,
  metalness: 0.15,
  roughness: 0.42,
  flatShading: false,
};

function canCreateWebGLContext() {
  try {
    const c = document.createElement('canvas');
    return !!(
      c.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      c.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      c.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false })
    );
  } catch {
    return false;
  }
}

/** Try several option sets; high-performance is last — some GPUs only expose WebGL on default/low-power. */
function createAboutRenderer() {
  const optionSets = [
    { antialias: true, alpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
    { antialias: true, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
    { antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false },
  ];
  let lastErr;
  for (const opts of optionSets) {
    try {
      const r = new THREE.WebGLRenderer(opts);
      if (r.getContext()) return r;
      r.dispose();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('WebGL unavailable');
}

function showWebGLUnavailable(loadingEl) {
  if (!loadingEl) return;
  loadingEl.classList.add('about-model-webgl-fail');
  loadingEl.innerHTML =
    '<span class="about-model-fail-title">3D needs WebGL</span>' +
    '<span class="about-model-fail-body">This page couldn’t start the graphics engine. In Chrome: Settings → System → turn on “Use graphics acceleration when available,” then relaunch. On Safari, check that Web content isn’t blocked and try disabling content blockers for this site. You can also try Firefox or another browser.</span>';
  loadingEl.removeAttribute('hidden');
}

/** Safari (and some mobile browsers) skip the first IntersectionObserver callback; scroll/resize + rAF cover that. */
function isNodeNearViewport(el, marginPx = 160) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return r.bottom > -marginPx && r.top < vh + marginPx && r.right > -marginPx && r.left < vw + marginPx;
}

function initAboutModel() {
  const root = document.getElementById('about-model-root');
  const loadingEl = document.getElementById('about-model-loading');
  const hintEl = document.getElementById('about-model-hint');
  if (!root) return;

  function fitObjectToView(object, camera, size = 1.6) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const dims = box.getSize(new THREE.Vector3());
    const max = Math.max(dims.x, dims.y, dims.z, 1e-6);
    const s = size / max;
    object.scale.setScalar(s);
    object.position.set(-center.x * s, -center.y * s, -center.z * s);
    box.setFromObject(object);
    const max2 = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z, 1e-6);
    const dist = max2 * 2.4;
    camera.position.set(dist * 0.55, dist * 0.45, dist * 0.9);
    camera.near = Math.max(0.01, dist / 200);
    camera.far = dist * 50;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  }

  function disposeMaterial(material) {
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach((m) => disposeSingleMaterial(m));
      return;
    }
    disposeSingleMaterial(material);
  }

  function disposeSingleMaterial(m) {
    if (!m) return;
    const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap'];
    maps.forEach((key) => {
      const tex = m[key];
      if (tex && tex.dispose) tex.dispose();
    });
    if (m.dispose) m.dispose();
  }

  function applyPortraitLook(rootObject) {
    const mat = new THREE.MeshStandardMaterial(PORTRAIT_MAT);
    rootObject.traverse((child) => {
      if (!child.isMesh) return;
      disposeMaterial(child.material);
      child.material = mat;
      if (child.geometry && !child.geometry.attributes.normal) {
        child.geometry.computeVertexNormals();
      }
    });
    return mat;
  }

  if (!canCreateWebGLContext()) {
    showWebGLUnavailable(loadingEl);
    return;
  }

  let renderer;
  try {
    renderer = createAboutRenderer();
  } catch {
    showWebGLUnavailable(loadingEl);
    return;
  }

  const W = 300;
  const H = 300;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f5fb);

  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 5000);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  root.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(2.2, 4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb8c4ff, 0.35);
  fill.position.set(-3, 1, -2);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.65;
  controls.minDistance = 0.4;
  controls.maxDistance = 12;

  let portraitMaterial = null;

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  loader.setDRACOLoader(draco);

  let modelLoaded = false;
  const loadTimeoutMs = 45000;
  const loadTimer = window.setTimeout(() => {
    if (modelLoaded) return;
    console.warn('[about-3d] GLB load timed out');
    if (loadingEl) {
      loadingEl.classList.add('about-model-webgl-fail');
      loadingEl.innerHTML =
        '<span class="about-model-fail-title">3D preview didn’t finish loading</span>' +
        '<span class="about-model-fail-body">Safari sometimes stalls on compressed 3D assets. Try a refresh, disable content blockers for this site, or open the page in Chrome or Firefox. If you’re on a slow connection, wait a bit longer.</span>';
      loadingEl.removeAttribute('hidden');
    }
  }, loadTimeoutMs);

  loader.load(
    MODEL_PATH,
    (gltf) => {
      modelLoaded = true;
      window.clearTimeout(loadTimer);
      const model = gltf.scene;
      portraitMaterial = applyPortraitLook(model);
      scene.add(model);
      fitObjectToView(model, camera);
      controls.target.set(0, 0, 0);
      controls.update();
      if (loadingEl) loadingEl.hidden = true;
      if (hintEl) hintEl.hidden = false;
    },
    undefined,
    (err) => {
      modelLoaded = true;
      window.clearTimeout(loadTimer);
      console.error('[about-3d] GLB load failed', err);
      if (loadingEl) {
        loadingEl.textContent = '3D model could not be loaded.';
        loadingEl.removeAttribute('hidden');
      }
    }
  );

  function tick() {
    requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  window.addEventListener(
    'beforeunload',
    () => {
      controls.dispose();
      renderer.dispose();
      draco.dispose();
      if (portraitMaterial) portraitMaterial.dispose();
    },
    { once: true }
  );
}

const root = document.getElementById('about-model-root');
if (root) {
  let started = false;

  function startAboutModel() {
    if (started) return;
    started = true;
    io.disconnect();
    window.removeEventListener('scroll', tryStart, { capture: false });
    window.removeEventListener('resize', tryStart, { capture: false });
    try {
      initAboutModel();
    } catch (err) {
      console.error('[about-3d] init failed', err);
      showWebGLUnavailable(document.getElementById('about-model-loading'));
    }
  }

  function tryStart() {
    if (started) return;
    if (isNodeNearViewport(root)) startAboutModel();
  }

  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      if (!e || !e.isIntersecting || started) return;
      startAboutModel();
    },
    { rootMargin: '120px', threshold: 0 }
  );
  io.observe(root);

  // Safari: IO may not fire when the section becomes visible; scroll/resize + rAF catch that.
  window.addEventListener('scroll', tryStart, { passive: true });
  window.addEventListener('resize', tryStart, { passive: true });
  requestAnimationFrame(() => {
    requestAnimationFrame(tryStart);
  });
}

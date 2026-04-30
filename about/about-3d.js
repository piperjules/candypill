/** Optimized portrait (~1.4 MB, Draco + simplified mesh); same midnight-blue material as before. */
const MODEL_PATH = new URL('../assets/models/midnight-portrait-about.glb', import.meta.url).href;

const PORTRAIT_MAT = {
  color: 0x2a3f6f,
  metalness: 0.15,
  roughness: 0.42,
  flatShading: false,
};

async function initAboutModel() {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
  const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
  const { DRACOLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js');
  const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js');

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

  const root = document.getElementById('about-model-root');
  const loadingEl = document.getElementById('about-model-loading');
  const hintEl = document.getElementById('about-model-hint');
  if (!root) return;

  const W = 300;
  const H = 300;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f5fb);

  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
  });
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
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(draco);

  loader.load(
    MODEL_PATH,
    (gltf) => {
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
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting || started) return;
      started = true;
      io.disconnect();
      initAboutModel().catch((err) => {
        console.error('[about-3d] init failed', err);
        const loadingEl = document.getElementById('about-model-loading');
        if (loadingEl) {
          loadingEl.textContent = '3D preview could not start.';
          loadingEl.removeAttribute('hidden');
        }
      });
    },
    { rootMargin: '100px' }
  );
  io.observe(root);
}

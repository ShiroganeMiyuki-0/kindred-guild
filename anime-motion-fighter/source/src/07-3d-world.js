// ===================== 3D WORLD =====================
function makeToonGradient() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 1;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0,0,1,1);
  ctx.fillStyle = '#7a7a7a'; ctx.fillRect(1,0,1,1);
  ctx.fillStyle = '#c4c4c4'; ctx.fillRect(2,0,1,1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(3,0,1,1);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
  return tex;
}

function init3DWorld() {
  const container = document.getElementById('webglContainer');
  if (!container) throw new Error('Game canvas container missing');
  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 240);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020617, 0.035);

  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 2.8, 12);
  camera.lookAt(0, 1.25, 0);

  const halfAspect = (width / 2) / height;
  cameraP1 = new THREE.PerspectiveCamera(58, halfAspect, 0.1, 100);
  cameraP2 = new THREE.PerspectiveCamera(58, halfAspect, 0.1, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  toonGradientMap = makeToonGradient();

  // Lighting
  scene.add(new THREE.AmbientLight(0x28324a, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-4, 10, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x38bdf8, 0.7);
  rim.position.set(6, 4, -6); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xff0055, 0.5);
  rim2.position.set(-6, 4, -6); scene.add(rim2);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x050810, roughness: 0.25, metalness: 0.6 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(30, 30, 0x00f0ff, 0x142033);
  gridHelper.position.y = 0.01;
  gridHelper.material.transparent = true; gridHelper.material.opacity = 0.3;
  scene.add(gridHelper);

  // Arena pillars
  for (let i = -12; i <= 12; i += 6) {
    if (i === 0) continue;
    const isBlue = i < 0;
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, emissive: isBlue ? 0x00e5ff : 0xff0055,
      emissiveIntensity: 0.7, metalness: 0.85, roughness: 0.25
    });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 12), pillarMat);
    pillar.position.set(i, 3.5, -7); pillar.castShadow = true;
    scene.add(pillar);
    const halo = makeGlowSprite(isBlue ? 0x38bdf8 : 0xf43f5e, 3.5);
    halo.position.set(i, 4.5, -7); scene.add(halo);
  }

  // Dome backdrop
  const domeGeo = new THREE.SphereGeometry(28, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshBasicMaterial({ color: 0x081226, side: THREE.BackSide, transparent: true, opacity: 0.9 });
  scene.add(new THREE.Mesh(domeGeo, domeMat));

  rebuildFighters3D();
  window.addEventListener('resize', () => {
    isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || (window.innerWidth <= 768);
    onWindowResize();
  });
}

function makeGlowSprite(colorHex, scale) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  const col = new THREE.Color(colorHex);
  g.addColorStop(0, `rgba(${col.r*255},${col.g*255},${col.b*255},0.9)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(scale, scale, 1);
  return spr;
}

function onWindowResize() {
  const container = document.getElementById('webglContainer');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  const halfAspect = (container.clientWidth / 2) / container.clientHeight;
  cameraP1.aspect = halfAspect; cameraP1.updateProjectionMatrix();
  cameraP2.aspect = halfAspect; cameraP2.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function updateSplitCameras() {
  const pX = playerFighter3D.group.position.x, pZ = playerFighter3D.group.position.z;
  const aX = aiFighter3D.group.position.x, aZ = aiFighter3D.group.position.z;
  cameraP1.position.set(pX - 2.6, 2.15, pZ + 1.1);
  cameraP1.lookAt(aX, 1.35, aZ);
  cameraP2.position.set(aX + 2.6, 2.15, aZ - 1.1);
  cameraP2.lookAt(pX, 1.35, pZ);
}

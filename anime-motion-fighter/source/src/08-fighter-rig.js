// ===================== FIGHTER RIG =====================
function rebuildFighters3D() {
  if (playerFighter3D) removeFighterVisuals(playerFighter3D);
  if (aiFighter3D) removeFighterVisuals(aiFighter3D);
  auraSprites.forEach(s => scene.remove(s)); auraSprites = [];

  playerFighter3D = buildFighterRig(selectedP1Char, false);
  aiFighter3D = buildFighterRig(selectedP2Char, true);
  playerFighter3D.group.position.set(player.x, 0, 0);
  aiFighter3D.group.position.set(ai.x, 0, 0);
  scene.add(playerFighter3D.motionSprite);
  scene.add(aiFighter3D.motionSprite);
  playerFighter3D.afterimages.forEach(s => scene.add(s));
  aiFighter3D.afterimages.forEach(s => scene.add(s));
  scene.add(playerFighter3D.group);
  scene.add(aiFighter3D.group);

  const auraP = makeGlowSprite(selectedP1Char.auraHex, 2.4);
  const auraA = makeGlowSprite(selectedP2Char.auraHex, 2.4);
  auraP.position.set(player.x, 0.05, 0); auraA.position.set(ai.x, 0.05, 0);
  scene.add(auraP); scene.add(auraA);
  auraSprites.push(auraP, auraA);
  playerFighter3D.aura = auraP; aiFighter3D.aura = auraA;
}

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  });
}

function removeFighterVisuals(rig) {
  if (!rig) return;
  if (rig.group) {
    disposeObject3D(rig.group);
    scene.remove(rig.group);
  }
  if (rig.motionSprite) {
    if (rig.motionSprite.material?.map) rig.motionSprite.material.map.dispose();
    rig.motionSprite.material?.dispose();
    scene.remove(rig.motionSprite);
  }
  rig.afterimages?.forEach(sprite => {
    if (sprite.material?.map) sprite.material.map.dispose();
    sprite.material?.dispose();
    scene.remove(sprite);
  });
  if (rig.motionTexture) rig.motionTexture.dispose();
}
function makeMotionTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  const color = new THREE.Color(colorHex);
  const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(64, 92, 12, 64, 92, 86);
  glow.addColorStop(0, `rgba(${rgb},0.42)`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 192);
  ctx.save();
  ctx.translate(64, 98);
  ctx.shadowColor = `rgba(${rgb},0.95)`; ctx.shadowBlur = 14;
  ctx.fillStyle = `rgba(${rgb},0.42)`; ctx.strokeStyle = `rgba(255,255,255,0.72)`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -58, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-24, -35); ctx.lineTo(24, -35); ctx.lineTo(31, 23); ctx.lineTo(0, 42); ctx.lineTo(-31, 23); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(-23, -24); ctx.lineTo(-43, 18); ctx.moveTo(23, -24); ctx.lineTo(43, 18); ctx.moveTo(-14, 39); ctx.lineTo(-23, 82); ctx.moveTo(14, 39); ctx.lineTo(23, 82); ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(13, -4); ctx.stroke();
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
function makeMotionSprite(colorHex, scale, texture) {
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.16, blending: THREE.AdditiveBlending, depthTest: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale * 0.82, scale, 1);
  sprite.center.set(0.5, 0.42);
  return sprite;
}
function createMotionVisuals(charConfig, isEnemy) {
  const texture = makeMotionTexture(charConfig.colorHex);
  const motionSprite = makeMotionSprite(charConfig.colorHex, 3.0, texture);
  const afterimages = [0, 1, 2].map(index => {
    const sprite = makeMotionSprite(charConfig.colorHex, 2.8, texture);
    sprite.material.opacity = 0;
    sprite.renderOrder = -1 - index;
    return sprite;
  });
  motionSprite.renderOrder = -2;
  motionSprite.userData.isEnemy = isEnemy;
  return { motionSprite, afterimages, motionTexture: texture };
}
function toonMat(colorHex, opts = {}) {
  return new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradientMap, ...opts });
}
function glowMat(colorHex) {
  return new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.4 });
}
function addOutline(mesh, thickness = 1.06) {
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.multiplyScalar(thickness);
  mesh.add(outline);
}

function buildFighterRig(charConfig, isEnemy) {
  const group = new THREE.Group();
  const bodyMat = toonMat(0x141b2e);
  const suitMat = toonMat(charConfig.colorHex, { emissive: charConfig.colorHex, emissiveIntensity: 0.15 });
  const skinMat = toonMat(0xffd8ae);
  const eyeMat = new THREE.MeshBasicMaterial({ color: charConfig.colorHex });

  const hips = new THREE.Group(); hips.position.y = 1.02; group.add(hips);

  // Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.75, 10), bodyMat);
  torso.position.y = 0.42; torso.castShadow = true; addOutline(torso);
  hips.add(torso);
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.16), suitMat);
  chestPlate.position.set(0, 0.6, 0.16); addOutline(chestPlate, 1.08);
  hips.add(chestPlate);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), glowMat(charConfig.colorHex));
  core.position.set(0, 0.62, 0.26); hips.add(core);
  const coreLight = new THREE.PointLight(charConfig.colorHex, 1.8, 3.5);
  coreLight.position.set(0, 0.62, 0.3); hips.add(coreLight);
  const beltMesh = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 16), suitMat);
  beltMesh.rotation.x = Math.PI / 2; beltMesh.position.y = 0.06; hips.add(beltMesh);

  // Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 8), skinMat);
  neck.position.y = 0.86; hips.add(neck);
  const headGroup = new THREE.Group(); headGroup.position.set(0, 1.02, 0); hips.add(headGroup);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skinMat);
  head.castShadow = true; addOutline(head, 1.05); headGroup.add(head);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
  eyeL.position.set(-0.08, 0.01, 0.19); headGroup.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.08; headGroup.add(eyeR);

  // Hair styles
  if (charConfig.hairStyle === 'SPIKY' || charConfig.hairStyle === 'NINJA') {
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.4, 5), suitMat);
      const ang = (i / 8) * Math.PI * 2;
      spike.position.set(Math.cos(ang)*0.12, 0.16+Math.random()*0.06, Math.sin(ang)*0.12*0.6-0.02);
      spike.rotation.set((Math.random()-0.5)*0.4, ang, Math.PI*0.12+(Math.random()-0.5)*0.3);
      headGroup.add(spike);
    }
    if (charConfig.hairStyle === 'NINJA') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.025, 8, 16, Math.PI*1.4), glowMat(charConfig.colorHex));
      band.rotation.x = Math.PI/2; band.position.y = 0.03; headGroup.add(band);
    }
  } else if (charConfig.hairStyle === 'WHITE') {
    const blindfold = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.2), bodyMat);
    blindfold.position.set(0, 0.02, 0.13); headGroup.add(blindfold);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 10, 0, Math.PI*2, 0, Math.PI*0.55), toonMat(0xf1f5f9));
    headGroup.add(cap);
  } else if (charConfig.hairStyle === 'HORNS') {
    const hornGeo = new THREE.ConeGeometry(0.06, 0.32, 6);
    const hornL = new THREE.Mesh(hornGeo, glowMat(charConfig.colorHex));
    hornL.position.set(-0.13, 0.2, -0.02); hornL.rotation.z = 0.5; headGroup.add(hornL);
    const hornR = hornL.clone(); hornR.position.x = 0.13; hornR.rotation.z = -0.5; headGroup.add(hornR);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 10, 0, Math.PI*2, 0, Math.PI*0.5), bodyMat);
    headGroup.add(cap);
  } else {
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.226, 16, 16, 0, Math.PI*2, 0, Math.PI*0.62), suitMat);
    headGroup.add(visor);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.06), glowMat(charConfig.colorHex));
    strip.position.set(0, 0.02, 0.2); headGroup.add(strip);
  }

  // Arms
  function buildArm(isLeft) {
    const side = isLeft ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.36, 0.7, 0);
    hips.add(shoulder);
    shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), suitMat));
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 8), bodyMat);
    upperArm.position.y = -0.21; upperArm.castShadow = true; addOutline(upperArm);
    shoulder.add(upperArm);
    const elbow = new THREE.Group();
    elbow.position.y = -0.42; shoulder.add(elbow);
    elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), bodyMat));
    const foreArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8), suitMat);
    foreArm.position.y = -0.2; foreArm.castShadow = true; addOutline(foreArm);
    elbow.add(foreArm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), glowMat(charConfig.colorHex));
    hand.position.y = -0.42; elbow.add(hand);
    return { shoulder, elbow, hand };
  }
  const armL = buildArm(true), armR = buildArm(false);

  // Legs
  function buildLeg(isLeft) {
    const side = isLeft ? -1 : 1;
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.16, 0, 0);
    hips.add(hipPivot);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.46, 8), bodyMat);
    thigh.position.y = -0.23; thigh.castShadow = true; addOutline(thigh);
    hipPivot.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.46; hipPivot.add(knee);
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), bodyMat));
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.46, 8), suitMat);
    shin.position.y = -0.23; shin.castShadow = true; addOutline(shin);
    knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), bodyMat);
    foot.position.set(0, -0.47, 0.05); knee.add(foot);
    return { hipPivot, knee, foot };
  }
  const legL = buildLeg(true), legR = buildLeg(false);

  if (isEnemy) group.rotation.y = -Math.PI / 2;
  else group.rotation.y = Math.PI / 2;
  const motionVisuals = createMotionVisuals(charConfig, isEnemy);

  return {
    group, hips, headGroup, armL, armR, legL, legR, coreLight,
    ...motionVisuals,
    cur: { shoulderL:0, elbowL:0, shoulderR:0, elbowR:0, hipL:0, kneeL:0, hipR:0, kneeR:0, bodyBend:0, headTurn:0, hipsY:0 }
  };
}

// ===================== FIGHTER ANIMATION =====================
function updateMotionVisuals(rig, entity, stance, isEnemy, dt) {
  if (!rig?.motionSprite) return;
  const now = performance.now();
  const action = ['PUNCH', 'KICK', 'SUPER'].includes(stance);
  const hit = (entity.hitFlash || 0) > 0;
  const pulse = 1 + Math.sin(now * 0.006 + (isEnemy ? 1.8 : 0)) * 0.035;
  const lean = action ? (isEnemy ? -0.08 : 0.08) : 0;
  const baseX = rig.group.position.x + lean;
  const baseY = 1.02 + (rig.hips.position.y - 1.02) * 0.45;
  rig.motionSprite.position.set(baseX, baseY, rig.group.position.z - 0.14);
  rig.motionSprite.scale.set(2.46 * pulse * (action ? 1.08 : 1), 3.0 * pulse * (stance === 'CROUCH' ? 0.82 : 1), 1);
  rig.motionSprite.material.opacity = hit ? 0.30 : (action ? 0.22 : 0.12);
  rig.motionSprite.material.rotation = Math.sin(now * 0.003) * 0.015 + (entity.knockback || 0) * 0.02;

  const echoStrength = action ? 0.18 : hit ? 0.10 : 0;
  rig.afterimages.forEach((sprite, index) => {
    const age = (index + 1) / rig.afterimages.length;
    sprite.position.set(baseX - (isEnemy ? -1 : 1) * age * (action ? 0.32 : 0.08), baseY, rig.group.position.z - 0.22 - age * 0.03);
    sprite.scale.set(2.46 * pulse, 3.0 * pulse, 1);
    sprite.material.opacity = echoStrength * (1 - age) * (0.8 + Math.sin(now * 0.008 + index) * 0.2);
    sprite.material.rotation = (isEnemy ? -1 : 1) * age * (action ? 0.10 : 0.025);
  });
}
function updateFighterRig(rig, entity, stance, isEnemy, dt) {
  const c = rig.cur;
  let tShoulderL = 0, tElbowL = 0, tShoulderR = 0, tElbowR = 0;
  let tHipL = 0, tKneeL = 0, tHipR = 0, tKneeR = 0, tHipsY = 0, tTurn = 0, tBend = 0;

  const liveLm = isEnemy ? (dualCamMode ? p2LiveLandmarks : null) : livePoseLandmarks;
  if (liveLm) {
    const nose = liveLm[0], shL = liveLm[11], shR = liveLm[12];
    const elL = liveLm[13], elR = liveLm[14], wrL = liveLm[15], wrR = liveLm[16];
    const hipL = liveLm[23], hipR = liveLm[24], knL = liveLm[25], knR = liveLm[26];
    const anL = liveLm[27], anR = liveLm[28];
    tShoulderR = Math.atan2(elR.y - shR.y, elR.x - shR.x) + Math.PI / 2;
    tElbowR = Math.atan2(wrR.y - elR.y, wrR.x - elR.x) - tShoulderR + Math.PI / 2;
    tShoulderL = Math.atan2(elL.y - shL.y, elL.x - shL.x) + Math.PI / 2;
    tElbowL = Math.atan2(wrL.y - elL.y, wrL.x - elL.x) - tShoulderL + Math.PI / 2;
    tHipR = Math.atan2(knR.y - hipR.y, knR.x - hipR.x) + Math.PI / 2;
    tKneeR = Math.atan2(anR.y - knR.y, anR.x - knR.x) - tHipR + Math.PI / 2;
    tHipL = Math.atan2(knL.y - hipL.y, knL.x - hipL.x) + Math.PI / 2;
    tKneeL = Math.atan2(anL.y - knL.y, anL.x - knL.x) - tHipL + Math.PI / 2;
    tHipsY = THREE.MathUtils.clamp((0.55 - (hipL.y + hipR.y) / 2) * 3.0, -0.55, 0.4);
    tTurn = THREE.MathUtils.clamp((nose.x - (shL.x + shR.x) / 2) * 2.2, -0.6, 0.6);
  } else {
    const t = performance.now() * 0.004;
    if (stance === 'CROUCH') { tHipsY = -0.42; tHipL = 0.5; tHipR = -0.5; tKneeL = 0.7; tKneeR = -0.7; }
    else if (stance === 'PUNCH') { if (!isEnemy) { tShoulderR = Math.PI / 2.1; tElbowR = 0.1; } else { tShoulderL = -Math.PI / 2.1; tElbowL = -0.1; } }
    else if (stance === 'KICK') { if (!isEnemy) { tHipR = -Math.PI / 2.3; tKneeR = 0.5; } else { tHipL = Math.PI / 2.3; tKneeL = -0.5; } }
    else if (stance === 'GUARD') { tShoulderL = -0.75; tElbowL = 0.5; tShoulderR = 0.75; tElbowR = -0.5; }
    else if (stance === 'CHARGING') { tShoulderL = -1.1; tElbowL = 0.9; tShoulderR = 1.1; tElbowR = -0.9; tHipsY = Math.sin(t * 6) * 0.02; }
    else { tHipsY = Math.sin(t * 2.5) * 0.04; tShoulderL = Math.sin(t * 2.5) * 0.08 - 0.1; tShoulderR = -Math.sin(t * 2.5) * 0.08 + 0.1; }
  }

  tBend += (entity.knockback || 0) * 0.6;
  const s = 1 - Math.pow(0.001, dt);
  c.shoulderL = lerpAngle(c.shoulderL, tShoulderL, s); c.elbowL = lerpAngle(c.elbowL, tElbowL, s);
  c.shoulderR = lerpAngle(c.shoulderR, tShoulderR, s); c.elbowR = lerpAngle(c.elbowR, tElbowR, s);
  c.hipL = lerpAngle(c.hipL, tHipL, s); c.kneeL = lerpAngle(c.kneeL, tKneeL, s);
  c.hipR = lerpAngle(c.hipR, tHipR, s); c.kneeR = lerpAngle(c.kneeR, tKneeR, s);
  c.headTurn = lerp(c.headTurn, tTurn, s); c.hipsY = lerp(c.hipsY, tHipsY, s);

  rig.armL.shoulder.rotation.z = c.shoulderL; rig.armL.elbow.rotation.z = c.elbowL;
  rig.armR.shoulder.rotation.z = c.shoulderR; rig.armR.elbow.rotation.z = c.elbowR;
  rig.legL.hipPivot.rotation.z = c.hipL; rig.legL.knee.rotation.z = c.kneeL;
  rig.legR.hipPivot.rotation.z = c.hipR; rig.legR.knee.rotation.z = c.kneeR;
  rig.headGroup.rotation.z = c.headTurn;
  rig.hips.position.y = 1.02 + c.hipsY;
  rig.hips.rotation.z = tBend * 0.3;

  const kb = entity.knockback || 0;
  if (kb !== 0) {
    rig.group.position.x += -kb * 0.05;
    entity.knockback *= 0.8;
    if (Math.abs(entity.knockback) < 0.01) entity.knockback = 0;
  }
  const homeX = (entity === player ? player.homeX : ai.homeX) ?? (isEnemy ? 3.2 : -3.2);
  rig.group.position.x = lerp(rig.group.position.x, homeX, 0.06);
  if (!isEnemy) rig.group.position.z = lerp(rig.group.position.z, entity.dodgeZ || 0, 0.15);

  if (entity.hitFlash > 0) {
    entity.hitFlash = Math.max(0, entity.hitFlash - 0.06);
    rig.coreLight.intensity = 1.8 + entity.hitFlash * 4;
  } else { rig.coreLight.intensity = 1.8; }
  if (rig.aura) rig.aura.position.set(rig.group.position.x, 0.05, 0);
  updateMotionVisuals(rig, entity, stance, isEnemy, dt);
}

// ===================== STATE =====================
let selectedGameMode = '1P';
let selectedModeVariant = 'CORE';
let selectedP1Char = CHARACTERS.GONE;
let selectedP2Char = CHARACTERS.RAONE;

let scene, camera, cameraP1, cameraP2, renderer, toonGradientMap;
let splitScreenOn = false;
let cameraView = 'FRONT';
let cameraFacingMode = 'user';
let cameraQuality = 'AUTO';
let trackingProfile = 'FRONT';
let cameraFeedVisible = true;
let cameraStream = null;
let poseLoopRunning = false;

let playerFighter3D, aiFighter3D;
let beamMesh = null, particles3D = [], auraSprites = [];
let speedLinesActive = false, speedLinesTimer = 0;

const fxCanvas = document.getElementById('fxCanvas');
const fxCtx = fxCanvas.getContext('2d');
const pipCanvas = document.getElementById('pipCanvas');
const pipCtx = pipCanvas.getContext('2d');

let gameLevel = 1, gameState = 'START';
let floatingTexts = [], combo = 0, comboTimer = null;
let trainingBeat = false, trainingBeatTimer = 0;
let sensitivityThreshold = 0.055;
let combatPhase = 'READY', combatPhaseUntil = 0;
let playerReadyForCombat = false;
let currentRound = 1, p1RoundWins = 0, p2RoundWins = 0, roundsToWin = 2, roundLocked = false;
let cameraShake = 0, hitStopFrames = 0;
let playerScore = 0, aiScore = 0;
let isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || (window.innerWidth <= 768);
let vrActive = false;
// Honor the OS "reduce motion" setting: tames screen shake, white flashes and speed lines.
const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let globalDistScale = 1.0;

// Pose tracking
let livePoseLandmarks = null, liveVisible = false;
let trackingLossFrames = 0;
let calibrationActive = false, calibrationStartedAt = 0, calibrationSamples = [];
let dualCamMode = false, p2LiveLandmarks = null, dualCamRunning = false;
let dualContactState = { p1: Object.create(null), p2: Object.create(null) };
let p1LimbCooldown = { LW:0, RW:0, LA:0, RA:0 }, p2LimbCooldown = { LW:0, RW:0, LA:0, RA:0 };
let p1PhysicalHitCooldown = 0; // now in ms
let poseStateFrames = { READY:0, GUARD:0, CHARGE:0, CROUCH:0 }; // debouncing
const POSE_DEBOUNCE_FRAMES = 3; // require 3 consistent frames before accepting pose change
let prevWristL = null, prevWristR = null, prevAnkleL = null, prevAnkleR = null;
let lastPoseFrameAt = 0, lastValidPoseAt = 0, lastChargeToneAt = 0;

// Player & AI state
const player = {
  x:-3.2, y:0, hp:100, maxHp:100, ki:0, maxKi:100,
  stance:'IDLE', lastAttackTime:0, lastGestureTime:0, attackLockUntil:0,
  isGuarding:false, isCharging:false, isCrouching:false, isStealthed:false,
  knockback:0, hitFlash:0, dodgeZ:0, dodgeBaseline:null, homeX:-3.2, counterUntil:0
};
const ai = {
  x:3.2, y:0, hp:100, maxHp:100, ki:0, maxKi:100,
  stance:'IDLE', actionTimer:0, reactionDelay:600,
  lastAttackTime:0, lastGestureTime:0, attackLockUntil:0,
  isGuarding:false, isCharging:false, isCrouching:false,
  knockback:0, hitFlash:0, homeX:3.2,
  history: { PUNCH:0, KICK:0, GUARD:0, CROUCH:0, CHARGE:0 },
  pendingAction:null, telegraphTimer:0, counterUntil:0
};

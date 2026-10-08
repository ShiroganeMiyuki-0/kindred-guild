// ===================== SMOOTHING =====================
class LandmarkSmoother {
  constructor(alpha = 0.55) { this.alpha = alpha; this.prev = null; }
  filter(lm) {
    if (!lm) return null;
    if (!this.prev || this.prev.length !== lm.length) { this.prev = lm.map(l => ({...l})); return this.prev; }
    const s = lm.map((l, i) => {
      const p = this.prev[i];
      return { ...l, x: this.alpha*l.x+(1-this.alpha)*p.x, y: this.alpha*l.y+(1-this.alpha)*p.y, z: this.alpha*l.z+(1-this.alpha)*p.z, visibility: l.visibility };
    });
    this.prev = s; return s;
  }
}
const smoother = new LandmarkSmoother(0.75);
const p2Smoother = new LandmarkSmoother(0.55);

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
function ptDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function ptDist3(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, (a.z||0) - (b.z||0)); }
function finiteLandmarks(lm) {
  const required = [11,12,15,16,23,24,27,28];
  return Array.isArray(lm) && lm.length >= 29 && required.every(i => Number.isFinite(lm[i]?.x) && Number.isFinite(lm[i]?.y));
}

// Convert #rrggbb or #rgb to rgba(...). Falls back to the input string
// if it doesn't look like a hex color (e.g. already-rgba or a CSS name).
function hexToRgba(color, alpha = 1) {
  if (typeof color !== 'string') return color;
  const hex = color.trim();
  let r, g, b;
  if (hex.length === 7 && hex[0] === '#') {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else if (hex.length === 4 && hex[0] === '#') {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

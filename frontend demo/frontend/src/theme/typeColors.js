//Help with unified colors across website
const ROOT = () => document.documentElement;

const slug = (t) =>
  String(t ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-"); // "ice storm" -> "ice-storm"

// Read a CSS variable; returns "" if missing
const cssVar = (name) =>
  getComputedStyle(ROOT()).getPropertyValue(name).trim();

// Try to get --type-<slug> ; if missing, return ""
export function cssColorForType(type) {
  const key = slug(type);
  if (!key) return "";
  return cssVar(`--type-${key}`);
}

// Deterministic fallback for unknown types
const FALLBACK = [
  "#e53935","#8e24aa","#3949ab","#00897b","#7cb342",
  "#fb8c00","#6d4c41","#00838f","#5e35b1","#1e88e5"
];

function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function getTypeColor(type) {
  const varColor = cssColorForType(type);
  if (varColor) return varColor;
  const s = String(type ?? "other");
  const idx = hash(s) % FALLBACK.length;
  return FALLBACK[idx];
}

//map a list of types to { type, color }
export function buildTypeColorMap(types) {
  const map = new Map();
  (types || []).forEach(t => map.set(t, getTypeColor(t)));
  return map;
}
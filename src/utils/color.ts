import type { DominantConflict } from '../types';

export const NEUTRAL_BRANCH = '#64748b'; // slate-500
export const MAIN_PATTERN_COLOR = '#2563eb'; // blue-600 - the reference/main resolution, everywhere
export const MISSING_COLOR = '#e5e7eb'; // near-white grey - no data, not a topology
export const UNINFORMATIVE_COLOR = '#e8dcb8'; // muted tan - data present, but no coherent signal for any topology (distinct from missing)
export const OTHER_COLOR = '#cbd5e1'; // grey-300 - the collapsed long tail

// Rank-based palette for named alternative patterns (2nd, 3rd, ... most common).
// Rank carries meaning ("the top alternative"), not hue identity across branches.
// Adapted from the Okabe-Ito colorblind-safe categorical set (a standard choice
// in scientific figures) rather than an arbitrary grab of saturated hues - each
// neighbor differs in both hue and lightness, and none of them are blue, which
// is reserved for the reference/main pattern everywhere else in the app.
export const ALT_PATTERN_PALETTE = [
  '#D55E00', // vermillion
  '#009E73', // bluish green
  '#CC79A7', // reddish purple
  '#E69F00', // orange
  '#7c3aed', // violet (kept from before - fills a gap Okabe-Ito leaves between purple and orange)
  '#B8860B', // dark goldenrod (deeper than 'orange' above, replaces low-contrast pale yellow)
  '#a3242a', // brick red (deeper than vermillion, for when more than 6 alternatives appear)
  '#0F766E', // teal-700 (deeper than bluish green, same reasoning)
  '#86198f', // fuchsia-800 (deeper than reddish purple)
];

export function altPatternColor(rankAmongAlts: number): string {
  return ALT_PATTERN_PALETTE[rankAmongAlts % ALT_PATTERN_PALETTE.length];
}

/** Same visual language as branch alternative patterns: rank 1 = blue (the plurality topology), then the warm palette, then grey for "other". */
export function topologyRankColor(rank: number, isOther: boolean): string {
  if (isOther) return OTHER_COLOR;
  if (rank === 1) return MAIN_PATTERN_COLOR;
  return altPatternColor(rank - 2);
}

export const CONFLICT_COLORS: Record<DominantConflict, string> = {
  none: NEUTRAL_BRANCH,
  low_conflict: '#475569', // slate-600, restrained neutral
  concentrated: '#dc2626', // red-600 - one specific alternative dominates
  contradicted: '#991b1b', // red-800 - the alternative actually beats the reference
  diffuse: '#9ca3af', // grey-400
  missing_data: '#cbd5e1', // grey-300
};

const EVIDENCE_GREY = '#9ca3af'; // grey-400 - no/low usable evidence at all, a different qualitative state
const EVIDENCE_GREY_CUTOFF = 0.15;
const EVIDENCE_LOW = [202, 138, 4]; // yellow-600 - mostly uninformative/missing
const EVIDENCE_HIGH = [37, 99, 235]; // blue-600 - mostly decisive (same blue as the reference pattern elsewhere)

/**
 * Evidence mode's color channel: blue (mostly decisive) -> yellow (mostly
 * uninformative/missing), one of the most colorblind-safe hue pairs (unlike
 * red-green, blue-yellow discrimination survives most forms of color
 * blindness). Falls to flat grey below a low-evidence cutoff, since "almost
 * no usable data" is a qualitatively different situation from "some data,
 * mostly uninformative" - not just a further step along the same gradient.
 */
export function evidenceColor(decisiveFraction: number): string {
  const t = Math.max(0, Math.min(1, decisiveFraction));
  if (t < EVIDENCE_GREY_CUTOFF) return EVIDENCE_GREY;
  const remapped = (t - EVIDENCE_GREY_CUTOFF) / (1 - EVIDENCE_GREY_CUTOFF);
  const r = Math.round(EVIDENCE_LOW[0] + (EVIDENCE_HIGH[0] - EVIDENCE_LOW[0]) * remapped);
  const g = Math.round(EVIDENCE_LOW[1] + (EVIDENCE_HIGH[1] - EVIDENCE_LOW[1]) * remapped);
  const b = Math.round(EVIDENCE_LOW[2] + (EVIDENCE_HIGH[2] - EVIDENCE_LOW[2]) * remapped);
  return `rgb(${r},${g},${b})`;
}

export function scaleWidth(value: number, min = 1, max = 8): number {
  const clamped = Math.max(0, Math.min(1, value));
  return min + Math.sqrt(clamped) * (max - min);
}

export function scaleOpacity(value: number, min = 0.25, max = 1): number {
  const clamped = Math.max(0, Math.min(1, value));
  return min + clamped * (max - min);
}

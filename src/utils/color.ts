import type { DominantConflict } from '../types';

export const NEUTRAL_BRANCH = '#64748b'; // slate-500
export const MAIN_PATTERN_COLOR = '#2563eb'; // blue-600 - the reference/main resolution, everywhere
export const MISSING_COLOR = '#e5e7eb'; // near-white grey - no data, not a topology
export const UNINFORMATIVE_COLOR = '#e8dcb8'; // muted tan - data present, but no coherent signal for any topology (distinct from missing)
export const OTHER_COLOR = '#cbd5e1'; // grey-300 - the collapsed long tail
export const HIDDEN_COLOR = '#f8fafc'; // matches page background - toggled-off pattern, fades out rather than draws the eye

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

export const CONFLICT_MISSING_DATA_COLOR = '#cbd5e1'; // grey-300 - too few decisive loci to assess conflict at all, not a point on the severity scale

const CONFLICT_LOW = [148, 163, 184]; // slate-400 - no meaningful conflict
const CONFLICT_HIGH = [127, 29, 29]; // red-900 - severe conflict
export const CONFLICT_LOW_COLOR = `rgb(${CONFLICT_LOW.join(',')})`;
export const CONFLICT_HIGH_COLOR = `rgb(${CONFLICT_HIGH.join(',')})`;

/**
 * Conflict mode's color channel: continuous shading from neutral slate (no
 * conflict) to deep red (severe conflict), scaled by the same value that
 * drives branch width (1 - concordantProportion) so color and width
 * reinforce one signal instead of splitting attention across two. The
 * specific *kind* of conflict (concentrated in one alternative, contradicted
 * by a more common one, or diffuse across many) is still available per
 * branch in the evidence panel - it's just not separately color-coded here
 * anymore. missing_data gets a flat, distinct grey instead of participating
 * in the gradient, since "no data to assess conflict" isn't a severity level.
 */
export function conflictColor(dominantConflict: DominantConflict, concordantProportion: number): string {
  if (dominantConflict === 'missing_data') return CONFLICT_MISSING_DATA_COLOR;
  const severity = Math.max(0, Math.min(1, 1 - concordantProportion));
  const r = Math.round(CONFLICT_LOW[0] + (CONFLICT_HIGH[0] - CONFLICT_LOW[0]) * severity);
  const g = Math.round(CONFLICT_LOW[1] + (CONFLICT_HIGH[1] - CONFLICT_LOW[1]) * severity);
  const b = Math.round(CONFLICT_LOW[2] + (CONFLICT_HIGH[2] - CONFLICT_LOW[2]) * severity);
  return `rgb(${r},${g},${b})`;
}

export const EVIDENCE_GREY = '#9ca3af'; // grey-400 - no/low usable evidence at all, a different qualitative state
export const EVIDENCE_GREY_CUTOFF = 0.15;
const EVIDENCE_LOW = [202, 138, 4]; // yellow-600 - mostly uninformative/missing
const EVIDENCE_HIGH = [37, 99, 235]; // blue-600 - mostly decisive (same blue as the reference pattern elsewhere)
export const EVIDENCE_LOW_COLOR = `rgb(${EVIDENCE_LOW.join(',')})`;
export const EVIDENCE_HIGH_COLOR = `rgb(${EVIDENCE_HIGH.join(',')})`;

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

const METADATA_LOW = [226, 232, 240]; // slate-200 - low end of a numeric metadata column
const METADATA_HIGH = [76, 29, 149]; // violet-900 - high end - kept distinct from the red/blue-yellow hues used elsewhere
export const METADATA_LOW_COLOR = `rgb(${METADATA_LOW.join(',')})`;
export const METADATA_HIGH_COLOR = `rgb(${METADATA_HIGH.join(',')})`;
export const METADATA_NO_DATA_COLOR = '#f1f5f9'; // near-white - locus has no value for this column, distinct from any real data point
// Categorical columns with more distinct values than ALT_PATTERN_PALETTE can
// color uniquely (e.g. an ID-like column) would otherwise alias two different
// values to the same color and imply a grouping that isn't real - flat neutral
// instead of a misleading color, with per-locus values still visible on hover.
export const METADATA_TOO_MANY_CATEGORIES_COLOR = '#94a3b8'; // slate-400

/** Continuous low->high shading for a numeric locus-metadata column, given a value already normalized to 0..1. */
export function metadataNumericColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(METADATA_LOW[0] + (METADATA_HIGH[0] - METADATA_LOW[0]) * clamped);
  const g = Math.round(METADATA_LOW[1] + (METADATA_HIGH[1] - METADATA_LOW[1]) * clamped);
  const b = Math.round(METADATA_LOW[2] + (METADATA_HIGH[2] - METADATA_LOW[2]) * clamped);
  return `rgb(${r},${g},${b})`;
}

/** Reuses the same categorical palette as topology alternatives, so category color language stays consistent app-wide. */
export function metadataCategoricalColor(categoryIndex: number): string {
  return altPatternColor(categoryIndex);
}

export function scaleWidth(value: number, min = 1, max = 8): number {
  const clamped = Math.max(0, Math.min(1, value));
  return min + Math.sqrt(clamped) * (max - min);
}

export function scaleOpacity(value: number, min = 0.25, max = 1): number {
  const clamped = Math.max(0, Math.min(1, value));
  return min + clamped * (max - min);
}

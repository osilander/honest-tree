import type { TopologyPattern } from '../types';
import { MAIN_PATTERN_COLOR, OTHER_COLOR, altPatternColor } from './color';

interface BipartitionSource {
  taxaLeft: string[];
  taxaRight: string[];
}

export function patternColor(pattern: TopologyPattern, altRank: number): string {
  if (pattern.isMain) return MAIN_PATTERN_COLOR;
  if (pattern.isOther) return OTHER_COLOR;
  return altPatternColor(altRank);
}

/** "Reference" / "Alternative A" / "Alternative B" / ... / "Other". */
export function patternTag(pattern: TopologyPattern, altRank: number): string {
  if (pattern.isMain) return 'Reference';
  if (pattern.isOther) return 'Other';
  return `Alternative ${String.fromCharCode(65 + (altRank % 26))}`;
}

function truncateList(taxa: string[], maxPerSide: number): string {
  if (taxa.length === 0) return '-';
  if (taxa.length <= maxPerSide) return taxa.join(', ');
  return `${taxa.slice(0, maxPerSide).join(', ')} +${taxa.length - maxPerSide} more`;
}

/** "(taxa...) | (taxa...)" - the actual bipartition this pattern implies, not just what moved. */
export function patternBipartition(branch: BipartitionSource, pattern: TopologyPattern, maxPerSide = 3): string {
  if (pattern.isOther) return '(mixed alternatives)';
  const extraSet = new Set(pattern.extraTaxa);
  const sideA = [...branch.taxaLeft, ...pattern.extraTaxa];
  const sideB = branch.taxaRight.filter((t) => !extraSet.has(t));
  return `(${truncateList(sideA, maxPerSide)}) | (${truncateList(sideB, maxPerSide)})`;
}

/** "Alternative A: (taxa...) | (taxa...)" - the combined tag + bipartition, used everywhere patterns are listed. */
export function patternLabel(branch: BipartitionSource, pattern: TopologyPattern, altRank: number, maxPerSide = 3): string {
  return `${patternTag(pattern, altRank)}: ${patternBipartition(branch, pattern, maxPerSide)}`;
}

/** Assigns each non-main, non-other pattern its rank among alternatives (0-based), for stable coloring and lettering. */
export function withAltRanks(patterns: TopologyPattern[]): { pattern: TopologyPattern; altRank: number }[] {
  let rank = 0;
  return patterns.map((pattern) => {
    if (pattern.isMain || pattern.isOther) return { pattern, altRank: -1 };
    return { pattern, altRank: rank++ };
  });
}

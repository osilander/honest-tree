import type { BranchRecord, TopologyPattern } from '../types';
import { patternLabel, withAltRanks } from '../utils/pattern';

/** Deterministic, template-based report - no LLM involved, per the design spec. */
export function generateNaturalLanguageReport(b: BranchRecord): string {
  const sentences: string[] = [
    characterizeSupport(b),
    topologyDiversitySentence(b),
    breakdownSentence(b),
    wanderingTaxaSentence(b),
    ...extraSentences(b),
  ];
  return sentences.filter(Boolean).join(' ');
}

function namedAlts(b: BranchRecord) {
  return b.topologyPatterns.filter((p) => !p.isMain && !p.isOther && p.count > 0);
}

function otherTail(b: BranchRecord) {
  return b.topologyPatterns.find((p) => p.isOther && p.count > 0) ?? null;
}

/**
 * The single most common non-reference *named* pattern, with its stable
 * alt-rank (for "Alternative A/B/..." lettering). Must exclude isOther - it's
 * a collapsed tail of many small, unrelated alternatives, not one specific
 * topology, so it can out-count every real alternative just by being a sum
 * of several without representing any single coherent disagreement.
 */
function topAlt(b: BranchRecord): { pattern: TopologyPattern; altRank: number } | null {
  const ranked = withAltRanks(b.topologyPatterns).filter(({ pattern }) => !pattern.isMain && !pattern.isOther && pattern.count > 0);
  if (ranked.length === 0) return null;
  return ranked.reduce((best, cur) => (cur.pattern.count > best.pattern.count ? cur : best));
}

function characterizeSupport(b: BranchRecord): string {
  const { decisiveLoci } = b.counts;
  if (decisiveLoci === 0) {
    return 'This branch has no decisive evidence in the current data set; interpretation is limited entirely by missing taxa.';
  }
  switch (b.dominantConflict) {
    case 'low_conflict':
      return b.support.concordantProportion >= 0.9
        ? 'This branch is strongly supported across decisive loci.'
        : 'This branch is well supported across decisive loci, with only minor conflict.';
    case 'concentrated': {
      const top = topAlt(b);
      return `This branch is weakly supported, with conflict concentrated in a single alternative topology${top ? ` (${patternLabel(b, top.pattern, top.altRank).toLowerCase()})` : ''}.`;
    }
    case 'contradicted': {
      const top = topAlt(b);
      return `This branch is contradicted: an alternative topology${top ? ` (${patternLabel(b, top.pattern, top.altRank).toLowerCase()})` : ''} is more common among decisive loci than the reference split.`;
    }
    case 'diffuse':
      return 'This branch is weakly supported, with conflict diffuse across multiple alternative topologies rather than concentrated in one.';
    default:
      return "This branch's support pattern is unresolved.";
  }
}

function topologyDiversitySentence(b: BranchRecord): string {
  const alts = namedAlts(b);
  const tail = otherTail(b);
  if (alts.length === 0 && !tail) return '';
  const count = alts.length + (tail ? 1 : 0);
  const plus = tail ? '+' : '';
  const word = count === 1 && !tail ? 'topology' : 'topologies';
  if (count <= 2) {
    return `Where this branch is contradicted, it is by only ${count}${plus} distinct alternative ${word}, so disagreement is concentrated rather than scattered.`;
  }
  if (count >= 6) {
    return `Disagreement is spread across at least ${count}${plus} distinct alternative ${word}, each individually weak.`;
  }
  return `Disagreement is split across ${count}${plus} distinct alternative ${word}.`;
}

function breakdownSentence(b: BranchRecord): string {
  const c = b.counts;
  if (c.decisiveLoci === 0) return '';
  const main = b.topologyPatterns.find((p) => p.isMain)!;
  const ranked = withAltRanks(b.topologyPatterns).filter(({ pattern }) => !pattern.isMain && !pattern.isOther && pattern.count > 0);
  const parts = [`${main.count} support the reference split`];
  for (const { pattern, altRank } of ranked.slice(0, 2)) {
    parts.push(`${pattern.count} ${patternLabel(b, pattern, altRank).toLowerCase()}`);
  }
  const rest = ranked.slice(2).reduce((acc, { pattern }) => acc + pattern.count, 0) + (otherTail(b)?.count ?? 0);
  if (rest > 0) parts.push(`${rest} split across the remaining alternatives`);
  return `Of ${c.decisiveLoci} decisive loci (out of ${c.totalLoci} total), ${parts.join(', ')}.`;
}

/** Names the taxa most often responsible for this branch's conflict, when one or two clearly dominate. */
function wanderingTaxaSentence(b: BranchRecord): string {
  const top = b.taxonInstability.filter((t) => t.conflictShare >= 0.15).slice(0, 3);
  if (top.length === 0) return '';
  const names = top.map((t) => t.taxon);
  const list = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  return `Most conflicting topologies involve ${list}.`;
}

function extraSentences(b: BranchRecord): string[] {
  const out: string[] = [];
  const c = b.counts;
  if (c.totalLoci > 0 && c.missingLoci / c.totalLoci >= 0.3) {
    out.push(`Interpretation is limited by missing data - ${c.missingLoci} of ${c.totalLoci} loci lack enough taxa to test this branch.`);
  }
  return out;
}

import type { Dataset, RawNode } from '../types';
import { annotateMasks, splitIdFor, type TaxonIndex } from './splits';
import { popcount } from './bitset';

export type TaxonSampleMode = 'off' | 'random' | 'diverged' | 'custom';

function terminalBranchLengths(root: RawNode): Map<string, number> {
  const out = new Map<string, number>();
  (function walk(n: RawNode) {
    if (n.children.length === 0) out.set(n.name, n.length ?? 0);
    else n.children.forEach(walk);
  })(root);
  return out;
}

/**
 * Picks which taxa to display. 'diverged' ranks by the reference tree's own
 * terminal (pendant) branch length - taxa on a long branch are phylogenetically
 * distinct and worth seeing; taxa on a very short branch are near-duplicates
 * of a neighbor and safe to drop first. 'random' is a uniform draw, useful as
 * an unbiased sanity check against the 'diverged' selection. 'custom' is an
 * explicit user-picked set, ignoring `count`.
 */
export function pickSampledTaxa(dataset: Dataset, mode: TaxonSampleMode, count: number, customSet?: Set<string>): string[] {
  const all = dataset.taxa;
  if (mode === 'off') return all;

  if (mode === 'custom') {
    const kept = all.filter((t) => customSet?.has(t));
    return kept.length > 0 ? kept : all;
  }

  if (count >= all.length) return all;

  if (mode === 'random') {
    const shuffled = [...all];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  const lengths = terminalBranchLengths(dataset.referenceTree);
  return [...all].sort((a, b) => (lengths.get(b) ?? 0) - (lengths.get(a) ?? 0)).slice(0, count);
}

/**
 * Prunes a reference tree down to `keep`, for display only. Returns the
 * pruned tree plus a map from each surviving node to the splitId of the
 * *original* clade it represents - recomputing splitIds from scratch on the
 * pruned tree would silently produce wrong bipartitions (missing bits for
 * every removed taxon), breaking support/color lookups for nearly every
 * branch. Call this with masks/index from the exact tree being pruned (i.e.
 * before any object-identity-changing step like collapseWeakBranches).
 */
export function pruneTaxaForDisplay(
  root: RawNode,
  index: TaxonIndex,
  keep: Set<string>,
): { root: RawNode; splitIdOf: Map<RawNode, string | null> } {
  const masks = annotateMasks(root, index);
  const splitIdOf = new Map<RawNode, string | null>();

  function originalSplitId(n: RawNode): string | null {
    const mask = masks.get(n)!;
    const complement = index.fullMask ^ mask;
    return popcount(mask) >= 2 && popcount(complement) >= 2 ? splitIdFor(mask, index.fullMask) : null;
  }

  function prune(n: RawNode): RawNode | null {
    if (n.children.length === 0) {
      return keep.has(n.name) ? n : null;
    }
    const kept = n.children.map(prune).filter((c): c is RawNode => c !== null);
    if (kept.length === 0) return null;
    if (kept.length === 1) return kept[0]; // collapse the now-redundant single-child chain
    const merged: RawNode = { name: n.name, length: n.length, children: kept };
    splitIdOf.set(merged, originalSplitId(n));
    return merged;
  }

  const prunedRoot = prune(root);
  if (!prunedRoot) throw new Error('Taxon sampling left no taxa to display.');
  return { root: prunedRoot, splitIdOf };
}

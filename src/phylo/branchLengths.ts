import type { ParsedTree, RawNode } from '../types';
import { annotateMasks, type TaxonIndex } from './splits';
import { popcount } from './bitset';

interface GeneTreeLengthIndex {
  geneMask: bigint;
  nodeByMask: Map<bigint, RawNode>;
}

function indexForLengths(trees: ParsedTree[], index: TaxonIndex): GeneTreeLengthIndex[] {
  return trees.map((t) => {
    const masks = annotateMasks(t.root, index);
    const nodeByMask = new Map<bigint, RawNode>();
    for (const [node, mask] of masks) nodeByMask.set(mask, node);
    return { geneMask: masks.get(t.root)!, nodeByMask };
  });
}

/** Smallest node in this gene tree whose mask fully contains `at`, or null if none has a defined length. */
function smallestEnclosingWithLength(entry: GeneTreeLengthIndex, at: bigint): RawNode | null {
  let best: RawNode | null = null;
  let bestPop = Infinity;
  for (const [mask, node] of entry.nodeByMask) {
    if ((mask & at) !== at) continue;
    if (node.length === null || node.length === undefined || !Number.isFinite(node.length)) continue;
    const p = popcount(mask);
    if (p < bestPop) {
      best = node;
      bestPop = p;
    }
  }
  return best;
}

/**
 * The greedy consensus reference tree has no inherent branch lengths (it's
 * built from topology/clade-frequency alone). This estimates each of its
 * branch lengths from the gene tree set: for every gene tree, find the
 * smallest clade that contains this branch's taxa (not requiring an exact
 * match - real, discordant data rarely displays every branch as an exact
 * clade) and use that node's length as one observation, then average.
 * Requiring an exact match and falling back to one flat global constant for
 * everything else collapses most branches onto the same repeated value; this
 * instead gives nearly every branch its own gene-tree-derived estimate.
 * Mutates `root` in place.
 */
export function assignAverageBranchLengths(root: RawNode, geneTrees: ParsedTree[], index: TaxonIndex): void {
  const geneIndex = indexForLengths(geneTrees, index);
  const refMasks = annotateMasks(root, index);

  for (const [node, mask] of refMasks) {
    if (node === root) continue;
    // A pendant (leaf) edge only ever involves one taxon, so it can never
    // clear a >=2 threshold - require just "present at all" there; internal
    // branches keep requiring >=2 so a single stray taxon can't drive the estimate.
    const minPresence = popcount(mask) >= 2 ? 2 : 1;

    const observations: number[] = [];
    for (const entry of geneIndex) {
      const at = mask & entry.geneMask;
      if (popcount(at) < minPresence) continue;
      const enclosing = smallestEnclosingWithLength(entry, at);
      if (enclosing) observations.push(enclosing.length!);
    }

    node.length = observations.length > 0 ? observations.reduce((a, b) => a + b, 0) / observations.length : 1;
  }
}

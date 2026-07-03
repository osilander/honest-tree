import type { LengthObservation, ParsedTree, RawNode } from '../types';
import { annotateMasks, splitIdFor, type TaxonIndex } from './splits';
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

/**
 * Smallest node in this gene tree whose mask fully contains `at`, or null if
 * none has a defined length. Returns the node's own mask alongside it so the
 * caller can tell whether this was an exact match (mask === at, a genuine
 * observation of this branch) or a coarser stand-in (mask a proper superset,
 * i.e. this gene tree didn't actually display the branch's exact clade).
 */
function smallestEnclosingWithLength(entry: GeneTreeLengthIndex, at: bigint): { node: RawNode; mask: bigint } | null {
  let best: RawNode | null = null;
  let bestMask = 0n;
  let bestPop = Infinity;
  for (const [mask, node] of entry.nodeByMask) {
    if ((mask & at) !== at) continue;
    if (node.length === null || node.length === undefined || !Number.isFinite(node.length)) continue;
    const p = popcount(mask);
    if (p < bestPop) {
      best = node;
      bestMask = mask;
      bestPop = p;
    }
  }
  return best ? { node: best, mask: bestMask } : null;
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
 * Mutates `root` in place, and also returns the raw observations behind each
 * average (keyed by splitId) - each one tagged `exact` or not, since most of
 * them can come from a coarser stand-in clade rather than a genuine
 * observation of this exact branch when the data is heavily discordant.
 */
export function assignAverageBranchLengths(
  root: RawNode,
  geneTrees: ParsedTree[],
  index: TaxonIndex,
): Map<string, LengthObservation[]> {
  const geneIndex = indexForLengths(geneTrees, index);
  const refMasks = annotateMasks(root, index);
  const observationsBySplit = new Map<string, LengthObservation[]>();

  for (const [node, mask] of refMasks) {
    if (node === root) continue;
    const complement = index.fullMask ^ mask;

    // A node whose mask is the entire taxon universe (complement empty) isn't
    // a real branch at all - it's the artificial "everything" node sitting
    // just under the tree's top-level stem (see rerootAtNode's unary-root
    // comment for the same structural quirk). No gene tree can ever have a
    // clade smaller than its own root that still encloses every taxon, so
    // this node can never get a real observation - falling back to the
    // generic "unknown" default of 1 would give it a length wildly larger
    // than any genuine branch (real lengths are often << 1), dwarfing the
    // whole tree's actual variation. It isn't a branch, so it gets no length.
    if (complement === 0n) {
      node.length = 0;
      continue;
    }

    // A pendant (leaf) edge only ever involves one taxon, so it can never
    // clear a >=2 threshold - require just "present at all" there; internal
    // branches keep requiring >=2 so a single stray taxon can't drive the estimate.
    const minPresence = popcount(mask) >= 2 ? 2 : 1;

    const observations: LengthObservation[] = [];
    for (const entry of geneIndex) {
      const at = mask & entry.geneMask;
      if (popcount(at) < minPresence) continue;
      const found = smallestEnclosingWithLength(entry, at);
      if (found) observations.push({ length: found.node.length!, exact: found.mask === at });
    }

    node.length = observations.length > 0 ? observations.reduce((a, o) => a + o.length, 0) / observations.length : 1;

    if (popcount(mask) >= 2 && popcount(complement) >= 2) {
      observationsBySplit.set(splitIdFor(mask, index.fullMask), observations);
    }
  }

  return observationsBySplit;
}

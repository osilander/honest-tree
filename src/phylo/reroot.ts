import type { RawNode } from '../types';
import { cloneTree } from '../parsing/newick';
import { annotateMasks, splitIdFor, type TaxonIndex } from './splits';
import { popcount } from './bitset';

function buildParentMap(root: RawNode): Map<RawNode, RawNode | null> {
  const map = new Map<RawNode, RawNode | null>();
  (function walk(n: RawNode, parent: RawNode | null) {
    map.set(n, parent);
    for (const c of n.children) walk(c, n);
  })(root, null);
  return map;
}

/** Finds the tree node whose incoming edge is the given branch's canonical split. */
export function findNodeForSplit(root: RawNode, index: TaxonIndex, splitId: string): RawNode | null {
  const masks = annotateMasks(root, index);
  let found: RawNode | null = null;
  (function walk(n: RawNode) {
    if (found || n.children.length === 0) return;
    const mask = masks.get(n)!;
    const complement = index.fullMask ^ mask;
    if (popcount(mask) >= 2 && popcount(complement) >= 2 && splitIdFor(mask, index.fullMask) === splitId) {
      found = n;
      return;
    }
    n.children.forEach(walk);
  })(root);
  return found;
}

/**
 * Returns "everything on the other side of node, as seen from excludeChild" -
 * node's other children plus, if node itself has a parent, the same thing
 * one level further up (recursively), attached via the edge that used to
 * point the other way. Always returns a fresh node (via cloneTree/object
 * literals - never a shared reference), so the caller is always free to set
 * `.length` on what comes back without touching anything else in the tree.
 */
function reverse(node: RawNode, excludeChild: RawNode, parentOf: Map<RawNode, RawNode | null>): RawNode {
  const kids: RawNode[] = node.children.filter((c) => c !== excludeChild).map(cloneTree);
  const parent = parentOf.get(node);
  if (parent) {
    const reversedParent = reverse(parent, node, parentOf);
    reversedParent.length = node.length; // the node<->parent edge doesn't change length, only direction
    kids.push(reversedParent);
  }
  return { name: '', length: null, children: kids };
}

/**
 * Re-roots the tree so `target`'s incoming edge becomes one side of a new
 * root bipartition - the standard "reroot on this branch" operation.
 * Bipartitions themselves are rooting-independent (a split's canonical id is
 * always min(mask, complement)), so this never touches which branches exist
 * or their splitIds - only which node the tree is drawn hanging from. That
 * means every existing support/color lookup downstream keeps working
 * unchanged on the result.
 */
export function rerootAtNode(root: RawNode, target: RawNode): RawNode {
  // The consensus builder wraps the real (>=2-child) top-level split in a
  // trivial single-child stem node, which carries no split of its own (its
  // mask exactly equals its one child's). Left in place, excluding a whole
  // branch on the way up can leave that stem with zero children, producing a
  // phantom empty-named "leaf". It's not a real branch, so just skip past it.
  let effectiveRoot = root;
  while (effectiveRoot.children.length === 1) effectiveRoot = effectiveRoot.children[0];

  if (target === effectiveRoot) return cloneTree(effectiveRoot);
  const parentOf = buildParentMap(effectiveRoot);
  const parent = parentOf.get(target)!;
  const remainder = reverse(parent, target, parentOf);
  const halfLen = target.length != null ? target.length / 2 : null;
  const targetClone = cloneTree(target);
  targetClone.length = halfLen;
  remainder.length = halfLen;
  return { name: '', length: null, children: [targetClone, remainder] };
}

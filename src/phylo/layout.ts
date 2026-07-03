import type { BranchRecord, LayoutNode, RawNode } from '../types';
import { annotateMasks, splitIdFor, type TaxonIndex } from './splits';
import { popcount } from './bitset';

export interface LayoutResult {
  root: LayoutNode;
  maxX: number;
  maxY: number;
  leafCount: number;
}

export interface LayoutOptions {
  useBranchLengths: boolean;
}

/**
 * Rectangular cladogram/phylogram layout. Tips are always aligned at the
 * furthest x (cladogram mode: x = totalHeight - node height; branch-length
 * mode: x = cumulative branch length from root, falling back to a unit edge
 * where a length is missing). y = mean of immediate children's y, the
 * convention FigTree/ape/ete3/ggtree all use - every fork sits exactly
 * between its own two children.
 */
export function computeLayout(
  root: RawNode,
  index: TaxonIndex,
  branches: Map<string, BranchRecord>,
  options: LayoutOptions,
  // When taxa have been pruned from `root` for display (see taxonSample.ts),
  // masks recomputed on the pruned tree no longer match the original
  // full-taxon splitIds - this carries the correct original identity through
  // instead, so support/color lookups stay accurate for whichever taxa
  // remain visible.
  splitIdOverride?: Map<RawNode, string | null>,
): LayoutResult {
  const masks = annotateMasks(root, index);

  const heightOf = new Map<RawNode, number>();
  (function computeHeight(n: RawNode): number {
    const hh = n.children.length === 0 ? 0 : 1 + Math.max(...n.children.map(computeHeight));
    heightOf.set(n, hh);
    return hh;
  })(root);
  const totalHeight = heightOf.get(root)!;

  let leafIndex = 0;
  let nodeCounter = 0;

  function build(n: RawNode, parentX: number): LayoutNode {
    const mask = masks.get(n)!;
    // Square-root each edge's own length before accumulating (not the running
    // total) - real branch-length distributions are often dominated by one or
    // two much-longer branches; rendered linearly, that one branch sets the
    // scale for the whole tree and everything else compresses toward the
    // origin, reading as "discretized" even though the values are all real
    // and distinct. sqrt preserves ordering while compressing that dynamic
    // range, the same fix Nextstrain/auspice uses for divergence trees.
    const x = options.useBranchLengths
      ? parentX + (n === root ? 0 : Math.sqrt(n.length ?? 1))
      : totalHeight - heightOf.get(n)!;
    const uniqueId = `node_${nodeCounter++}`;

    if (n.children.length === 0) {
      const y = leafIndex;
      leafIndex++;
      return { id: uniqueId, name: n.name, isLeaf: true, children: [], x, y, splitId: null, branchId: null, mask };
    }

    const kids = n.children.map((c) => build(c, x));
    const y = kids.reduce((acc, k) => acc + k.y, 0) / kids.length;

    let splitId: string | null = null;
    if (splitIdOverride) {
      splitId = splitIdOverride.get(n) ?? null;
    } else {
      const complement = index.fullMask ^ mask;
      if (popcount(mask) >= 2 && popcount(complement) >= 2) {
        splitId = splitIdFor(mask, index.fullMask);
      }
    }
    const branchId = splitId ? branches.get(splitId)?.branchId ?? null : null;
    return { id: uniqueId, name: '', isLeaf: false, children: kids, x, y, splitId, branchId, mask };
  }

  const layoutRoot = build(root, 0);

  let maxX = 0;
  (function collect(n: LayoutNode) {
    if (n.x > maxX) maxX = n.x;
    n.children.forEach(collect);
  })(layoutRoot);

  return { root: layoutRoot, maxX, maxY: Math.max(0, leafIndex - 1), leafCount: leafIndex };
}

export interface LayoutEdge {
  parent: LayoutNode;
  child: LayoutNode;
}

export function collectEdges(root: LayoutNode): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  (function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  })(root);
  return edges;
}

export function collectNodes(root: LayoutNode): LayoutNode[] {
  const nodes: LayoutNode[] = [];
  (function walk(n: LayoutNode) {
    nodes.push(n);
    n.children.forEach(walk);
  })(root);
  return nodes;
}

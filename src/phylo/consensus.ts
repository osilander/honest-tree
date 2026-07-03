import type { RawNode } from '../types';
import type { TaxonIndex } from './splits';
import { popcount, compareMasks } from './bitset';

interface Cluster {
  mask: bigint;
  name?: string;
  children: Cluster[];
}

/**
 * Attempts to insert `mask` as a clade into `level` (an array of sibling clusters),
 * recursing into whichever cluster fully contains it. Returns false if `mask` is
 * incompatible with the current hierarchy (crosses an existing cluster boundary),
 * in which case it is simply skipped - this is the standard greedy-consensus
 * compatibility test, done implicitly rather than as a separate pre-check.
 */
function tryInsert(level: Cluster[], mask: bigint): boolean {
  const overlapping = level.filter((c) => (c.mask & mask) !== 0n);
  if (overlapping.length === 0) return false;

  const unionOverlap = overlapping.reduce((acc, c) => acc | c.mask, 0n);

  if (unionOverlap === mask) {
    if (overlapping.length <= 1) return true; // already represented, no-op
    const newCluster: Cluster = { mask, children: overlapping };
    const remaining = level.filter((c) => !overlapping.includes(c));
    level.length = 0;
    level.push(...remaining, newCluster);
    return true;
  }

  if (overlapping.length === 1 && (mask & overlapping[0].mask) === mask) {
    return tryInsert(overlapping[0].children, mask);
  }

  return false; // crosses cluster boundaries - incompatible, skip
}

function countLeaves(n: RawNode): number {
  if (n.children.length === 0) return 1;
  return n.children.reduce((acc, c) => acc + countLeaves(c), 0);
}

function minLeafName(n: RawNode): string {
  if (n.children.length === 0) return n.name;
  return n.children.map(minLeafName).reduce((a, b) => (a < b ? a : b));
}

function ladderize(nodes: RawNode[]): RawNode[] {
  return [...nodes].sort((x, y) => {
    const sizeX = countLeaves(x);
    const sizeY = countLeaves(y);
    if (sizeY !== sizeX) return sizeY - sizeX;
    return minLeafName(x).localeCompare(minLeafName(y));
  });
}

function clusterToRawNode(c: Cluster): RawNode {
  if (c.children.length === 0) return { name: c.name!, length: null, children: [] };
  const kids = ladderize(c.children.map(clusterToRawNode));
  return { name: '', length: null, children: kids };
}

/**
 * Builds a greedy consensus tree from clade frequencies: clades are inserted in
 * decreasing frequency order (ties broken by size, then canonical mask order),
 * kept whenever they're compatible with everything already accepted. Taxa never
 * observed in any accepted clade remain as an unresolved polytomy at whatever
 * level they were left at - this always includes every taxon in `index`, even
 * ones that were missing from most gene trees.
 */
export function buildGreedyConsensus(index: TaxonIndex, cladeFrequencies: Map<bigint, number>): RawNode {
  const clusters: Cluster[] = index.taxa.map((name, i) => ({
    mask: 1n << BigInt(i),
    name,
    children: [],
  }));

  const sorted = [...cladeFrequencies.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const popA = popcount(a[0]);
    const popB = popcount(b[0]);
    if (popB !== popA) return popB - popA;
    return compareMasks(a[0], b[0]);
  });

  for (const [mask] of sorted) {
    if (popcount(mask) < 2) continue;
    tryInsert(clusters, mask);
  }

  const rootChildren = ladderize(clusters.map(clusterToRawNode));
  return { name: '', length: null, children: rootChildren };
}

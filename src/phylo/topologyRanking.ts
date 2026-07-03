import type { ParsedTree, RawNode, TopologyRanking } from '../types';

const MAX_NAMED_RANK = 9;

/** Child-order-independent topology fingerprint (branch lengths ignored). */
function canonicalKey(node: RawNode): string {
  if (node.children.length === 0) return node.name;
  const kids = node.children.map(canonicalKey).sort();
  return `(${kids.join(',')})`;
}

/**
 * Ranks the distinct whole-tree topologies actually observed across the gene
 * tree set by frequency - independent of the compatible-splits reference
 * tree used elsewhere. Rank 1 is the plurality-winning exact topology.
 */
export function computeTopologyRanking(trees: ParsedTree[]): TopologyRanking {
  const countByKey = new Map<string, number>();
  const keyByLocus = new Map<string, string>();

  for (const t of trees) {
    const key = canonicalKey(t.root);
    keyByLocus.set(t.name, key);
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
  }

  const sortedKeys = [...countByKey.entries()].sort((a, b) => b[1] - a[1]);
  const rankOfKey = new Map<string, number>();
  sortedKeys.forEach(([key], i) => rankOfKey.set(key, i + 1));

  const locusRank = new Map<string, number>();
  for (const [locus, key] of keyByLocus) {
    const rank = rankOfKey.get(key)!;
    locusRank.set(locus, rank > MAX_NAMED_RANK ? MAX_NAMED_RANK + 1 : rank);
  }

  const ranks = sortedKeys.slice(0, MAX_NAMED_RANK).map(([, count], i) => ({
    rank: i + 1,
    count,
    isOther: false,
  }));
  const otherCount = sortedKeys.slice(MAX_NAMED_RANK).reduce((acc, [, c]) => acc + c, 0);
  if (otherCount > 0) {
    ranks.push({ rank: MAX_NAMED_RANK + 1, count: otherCount, isOther: true });
  }

  return { locusRank, ranks, maxNamedRank: MAX_NAMED_RANK };
}

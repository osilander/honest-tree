import type { Dataset } from '../types';

/** Locus names in the requested display order, shared by every locus track so their x-axes line up. */
export function orderedLoci(dataset: Dataset, mode: 'chrom' | 'sorted'): string[] {
  const names = dataset.geneTrees.map((t) => t.name);
  if (mode !== 'sorted') return names;
  const { locusRank } = dataset.topologyRanking;
  return [...names].sort((a, b) => locusRank.get(a)! - locusRank.get(b)!);
}

export function subsample<T>(items: T[], maxPoints: number | null): T[] {
  if (maxPoints === null || items.length <= maxPoints) return items;
  return Array.from({ length: maxPoints }, (_, i) => items[Math.floor((i * items.length) / maxPoints)]);
}

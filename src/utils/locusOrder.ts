import type { BranchRecord, Dataset } from '../types';
import { withAltRanks } from './pattern';

export type LocusSortMode = 'chrom' | 'rank' | 'metadata' | 'branchPattern';

/**
 * Locus names in the requested display order, shared by every locus track so
 * their x-axes line up (when they're showing the same order). One sort mode
 * applies to whichever tracks are visible - there's no per-track order, so
 * "what order is everything in" has one answer.
 *
 * 'metadata' needs a column name (the one driving the metadata track's
 * display) - numeric columns sort ascending by value (missing values last);
 * categorical columns group by value, most common group first, ties broken
 * by original order (stable sort). Falls back to chrom order if no column is
 * given.
 *
 * 'branchPattern' needs the currently-selected branch - groups loci by that
 * branch's own classification (reference first, then each alternative by
 * rank, then other/uninformative/missing), ties broken by original order.
 * Falls back to chrom order if no branch is selected.
 */
export function orderedLoci(dataset: Dataset, mode: LocusSortMode, metadataColumn?: string | null, branch?: BranchRecord | null): string[] {
  const names = dataset.geneTrees.map((t) => t.name);

  if (mode === 'rank') {
    const { locusRank } = dataset.topologyRanking;
    return [...names].sort((a, b) => locusRank.get(a)! - locusRank.get(b)!);
  }

  if (mode === 'metadata' && metadataColumn) {
    const table = dataset.locusMetadataTable;
    const col = table?.columns.find((c) => c.name === metadataColumn);
    if (table && col) {
      if (col.kind === 'numeric') {
        return [...names].sort((a, b) => {
          const va = table.values.get(a)?.[metadataColumn];
          const vb = table.values.get(b)?.[metadataColumn];
          const na = typeof va === 'number' ? va : Infinity;
          const nb = typeof vb === 'number' ? vb : Infinity;
          return na - nb;
        });
      }
      const counts = new Map<string, number>();
      for (const name of names) {
        const v = table.values.get(name)?.[metadataColumn];
        const key = v === undefined ? '' : String(v);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const groupRank = new Map<string, number>();
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([key], i) => groupRank.set(key, i));
      return [...names].sort((a, b) => {
        const ka = String(table.values.get(a)?.[metadataColumn] ?? '');
        const kb = String(table.values.get(b)?.[metadataColumn] ?? '');
        return groupRank.get(ka)! - groupRank.get(kb)!;
      });
    }
  }

  if (mode === 'branchPattern' && branch) {
    const ranked = withAltRanks(branch.topologyPatterns);
    const groupOrder = [...branch.topologyPatterns.map((p) => p.key), 'uninformative', 'missing'];
    const groupRank = new Map(groupOrder.map((k, i) => [k, i]));
    const groupKeyFor = (name: string): string => {
      const key = branch.locusPatternKey[name] ?? 'missing';
      if (key === 'missing' || key === 'uninformative') return key;
      return ranked.some((r) => r.pattern.key === key) ? key : 'other';
    };
    return [...names].sort((a, b) => (groupRank.get(groupKeyFor(a)) ?? Infinity) - (groupRank.get(groupKeyFor(b)) ?? Infinity));
  }

  return names;
}

/** Human-readable description of the current locus order, for track headers. */
export function orderLabel(mode: LocusSortMode, metadataColumn?: string | null, hasBranch?: boolean): string {
  if (mode === 'branchPattern' && hasBranch) return "grouped by this branch's pattern";
  if (mode === 'metadata' && metadataColumn) return `sorted by ${metadataColumn}`;
  if (mode === 'rank') return 'sorted by rank';
  return 'file order';
}

export function subsample<T>(items: T[], maxPoints: number | null): T[] {
  if (maxPoints === null || items.length <= maxPoints) return items;
  return Array.from({ length: maxPoints }, (_, i) => items[Math.floor((i * items.length) / maxPoints)]);
}

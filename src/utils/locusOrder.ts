import type { Dataset } from '../types';

export type LocusOrderMode = 'chrom' | 'sorted' | 'metadata';

/**
 * Locus names in the requested display order, shared by every locus track so
 * their x-axes line up. 'metadata' mode needs a column name (the same one
 * driving the metadata track's display, since there's only one selected
 * column app-wide) - numeric columns sort ascending by value (missing values
 * last); categorical columns group by value, most common group first, ties
 * broken by original order (stable sort).
 */
export function orderedLoci(dataset: Dataset, mode: LocusOrderMode, metadataColumn?: string | null): string[] {
  const names = dataset.geneTrees.map((t) => t.name);

  if (mode === 'sorted') {
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

  return names;
}

/** Human-readable description of the current locus order, for track headers. */
export function orderLabel(mode: LocusOrderMode, metadataColumn?: string | null): string {
  if (mode === 'metadata' && metadataColumn) return `sorted by ${metadataColumn}`;
  if (mode === 'sorted') return 'sorted by rank';
  return 'file order (chromosome position)';
}

export function subsample<T>(items: T[], maxPoints: number | null): T[] {
  if (maxPoints === null || items.length <= maxPoints) return items;
  return Array.from({ length: maxPoints }, (_, i) => items[Math.floor((i * items.length) / maxPoints)]);
}

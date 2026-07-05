import { useMemo, useState } from 'react';
import type { Dataset } from '../types';
import { HIDDEN_COLOR, METADATA_HIGH_COLOR, METADATA_LOW_COLOR, METADATA_NO_DATA_COLOR, metadataCategoricalColor, metadataNumericColor } from '../utils/color';
import { orderedLoci, subsample } from '../utils/locusOrder';

interface LocusMetadataTrackProps {
  dataset: Dataset;
  mode: 'chrom' | 'sorted';
  maxPoints: number | null;
  column: string;
}

export function LocusMetadataTrack({ dataset, mode, maxPoints, column }: LocusMetadataTrackProps) {
  const table = dataset.locusMetadataTable;
  const names = orderedLoci(dataset, mode);
  const shown = subsample(names, maxPoints);
  const total = shown.length || 1;
  const subsampled = shown.length < names.length;
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const col = table?.columns.find((c) => c.name === column);

  const { min, max } = useMemo(() => {
    if (!table || !col || col.kind !== 'numeric') return { min: 0, max: 1 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const rec of table.values.values()) {
      const v = rec[column];
      if (typeof v === 'number' && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!Number.isFinite(lo)) return { min: 0, max: 1 };
    return { min: lo, max: hi === lo ? lo + 1 : hi };
  }, [table, col, column]);

  // Stable category order (first appearance in the current locus order), so the
  // same category always gets the same color/legend position across re-renders.
  const categories = useMemo(() => {
    if (!table || !col || col.kind !== 'categorical') return [];
    const seen: string[] = [];
    const seenSet = new Set<string>();
    for (const name of names) {
      const v = table.values.get(name)?.[column];
      if (typeof v === 'string' && !seenSet.has(v)) {
        seenSet.add(v);
        seen.push(v);
      }
    }
    return seen;
  }, [table, col, column, names]);

  if (!table || !col) return null;

  const toggleCategory = (cat: string) =>
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const valueFor = (name: string) => table.values.get(name)?.[column];

  const colorFor = (name: string): string => {
    const v = valueFor(name);
    if (v === undefined) return METADATA_NO_DATA_COLOR;
    if (col.kind === 'numeric') {
      const t = max > min ? ((v as number) - min) / (max - min) : 0.5;
      return metadataNumericColor(t);
    }
    if (hiddenCategories.has(v as string)) return HIDDEN_COLOR;
    return metadataCategoricalColor(categories.indexOf(v as string));
  };

  const labelFor = (name: string): string => {
    const v = valueFor(name);
    return v === undefined ? `${name}: no "${column}" value` : `${name}: ${column} = ${v}`;
  };

  return (
    <div className="locus-track">
      <div className="locus-track-header">
        <span className="toolbar-label">
          Locus metadata - {column}, {mode === 'chrom' ? 'file order (chromosome position)' : 'sorted by rank'}
          {subsampled && ` - showing ${shown.length} of ${names.length} loci`}
        </span>
      </div>
      <svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" width="100%" height="18" className="locus-track-svg">
        {shown.map((name, i) => (
          <rect key={`${name}_${i}`} x={i} y={0} width={1} height={1} fill={colorFor(name)}>
            <title>{labelFor(name)}</title>
          </rect>
        ))}
      </svg>
      <div className="locus-track-legend">
        {col.kind === 'numeric' ? (
          <span className="legend-item" title="Continuous range across loci that have a value for this column.">
            <span className="legend-swatch metadata-gradient-swatch" style={{ background: `linear-gradient(90deg, ${METADATA_LOW_COLOR}, ${METADATA_HIGH_COLOR})` }} />
            {min.toFixed(2)} to {max.toFixed(2)}
          </span>
        ) : (
          categories.map((cat, i) => (
            <button
              key={cat}
              className={`legend-item legend-toggle${hiddenCategories.has(cat) ? ' legend-toggle-off' : ''}`}
              onClick={() => toggleCategory(cat)}
              title={`${cat} - click to show/hide`}
            >
              <span className="legend-swatch" style={{ background: metadataCategoricalColor(i) }} />
              {cat}
            </button>
          ))
        )}
        <span className="legend-item" title="No value in the uploaded table for this locus.">
          <span className="legend-swatch" style={{ background: METADATA_NO_DATA_COLOR }} />
          No data
        </span>
      </div>
    </div>
  );
}

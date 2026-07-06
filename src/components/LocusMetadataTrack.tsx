import { useMemo, useState } from 'react';
import type { BranchRecord, Dataset } from '../types';
import {
  ALT_PATTERN_PALETTE,
  HIDDEN_COLOR,
  METADATA_HIGH_COLOR,
  METADATA_LOW_COLOR,
  METADATA_NO_DATA_COLOR,
  METADATA_TOO_MANY_CATEGORIES_COLOR,
  metadataCategoricalColor,
  metadataNumericColor,
} from '../utils/color';
import { clickHoverHint, orderedLoci, subsample, type LocusSortMode } from '../utils/locusOrder';

interface LocusMetadataTrackProps {
  dataset: Dataset;
  mode: LocusSortMode;
  maxPoints: number | null;
  column: string;
  branch: BranchRecord | null;
  onHeaderClick: () => void;
}

export function LocusMetadataTrack({ dataset, mode, maxPoints, column, branch, onHeaderClick }: LocusMetadataTrackProps) {
  const table = dataset.locusMetadataTable;
  const names = orderedLoci(dataset, mode, column, branch);
  const shown = subsample(names, maxPoints);
  const total = shown.length || 1;
  const subsampled = shown.length < names.length;
  const active = mode === 'metadata';
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

  // Beyond the palette size, categories would start reusing colors - two
  // unrelated values would look like the same group, and a legend button per
  // value (possibly hundreds, e.g. an ID-like column) is clutter, not a useful
  // toggle. Fall back to one flat neutral color and a plain count instead.
  const tooManyCategories = col.kind === 'categorical' && categories.length > ALT_PATTERN_PALETTE.length;

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
    if (tooManyCategories) return METADATA_TOO_MANY_CATEGORIES_COLOR;
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
        <button className={`locus-track-header-btn${active ? ' locus-track-header-active' : ''}`} onClick={onHeaderClick}>
          Locus metadata - {column}
          {clickHoverHint(active, col.kind === 'numeric' ? 'sorted by value' : 'grouped by value', col.kind === 'numeric' ? 'sort by value' : 'group by value', 'values')}
          {subsampled && ` - showing ${shown.length} of ${names.length} loci`}
        </button>
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
        ) : tooManyCategories ? (
          <span className="legend-item" title="Too many distinct values to color-code or toggle individually - hover a locus in the track above to see its value.">
            <span className="legend-swatch" style={{ background: METADATA_TOO_MANY_CATEGORIES_COLOR }} />
            {categories.length} distinct values - hover for individual values
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

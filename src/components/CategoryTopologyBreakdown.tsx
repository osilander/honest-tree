import type { BranchRecord, Dataset } from '../types';
import { MAIN_PATTERN_COLOR, MISSING_COLOR, OTHER_COLOR, UNINFORMATIVE_COLOR } from '../utils/color';

interface CategoryTopologyBreakdownProps {
  dataset: Dataset;
  branch: BranchRecord;
  column: string;
}

interface GroupCounts {
  total: number;
  main: number;
  alt: number;
  uninformative: number;
  missing: number;
}

const NO_DATA_LABEL = '(no data)';

/**
 * Cross-tabulates a branch's per-locus classification (recovered / any
 * alternative / uninformative / missing) against a categorical locus-metadata
 * column, e.g. "does this branch's support differ between GC1 and GC3 genes".
 * Both inputs already exist per-locus (branch.locusPatternKey, the metadata
 * table) - this is a groupby over data already in memory, nothing new to
 * compute upstream.
 */
export function CategoryTopologyBreakdown({ dataset, branch, column }: CategoryTopologyBreakdownProps) {
  const table = dataset.locusMetadataTable;
  const col = table?.columns.find((c) => c.name === column);
  if (!table || !col || col.kind !== 'categorical') return null;

  const groups = new Map<string, GroupCounts>();
  for (const tree of dataset.geneTrees) {
    const value = table.values.get(tree.name)?.[column];
    const groupKey = value === undefined ? NO_DATA_LABEL : String(value);
    const g = groups.get(groupKey) ?? { total: 0, main: 0, alt: 0, uninformative: 0, missing: 0 };
    g.total++;
    const key = branch.locusPatternKey[tree.name] ?? 'missing';
    if (key === 'missing') g.missing++;
    else if (key === 'uninformative') g.uninformative++;
    else {
      const pattern = branch.topologyPatterns.find((p) => p.key === key);
      if (pattern?.isMain) g.main++;
      else g.alt++;
    }
    groups.set(groupKey, g);
  }

  const rows = [...groups.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="category-breakdown">
      {rows.map(([label, g]) => (
        <div key={label} className="category-breakdown-row" title={`${label}: ${g.total} loci - ${g.main} recovered, ${g.alt} alternative, ${g.uninformative} uninformative, ${g.missing} missing`}>
          <span className="category-breakdown-label">{label}</span>
          <div className="category-breakdown-bar">
            {g.main > 0 && <span style={{ width: `${(g.main / g.total) * 100}%`, background: MAIN_PATTERN_COLOR }} />}
            {g.alt > 0 && <span style={{ width: `${(g.alt / g.total) * 100}%`, background: OTHER_COLOR }} />}
            {g.uninformative > 0 && <span style={{ width: `${(g.uninformative / g.total) * 100}%`, background: UNINFORMATIVE_COLOR }} />}
            {g.missing > 0 && <span style={{ width: `${(g.missing / g.total) * 100}%`, background: MISSING_COLOR }} />}
          </div>
          <span className="category-breakdown-count">{g.total}</span>
        </div>
      ))}
      <div className="category-breakdown-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: MAIN_PATTERN_COLOR }} />
          Recovered
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: OTHER_COLOR }} />
          Alternative
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: UNINFORMATIVE_COLOR }} />
          Uninformative
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: MISSING_COLOR }} />
          Missing
        </span>
      </div>
    </div>
  );
}

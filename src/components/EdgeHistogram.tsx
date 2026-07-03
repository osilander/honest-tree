import { useState } from 'react';
import type { BranchRecord } from '../types';
import { MISSING_COLOR } from '../utils/color';
import { patternColor, patternLabel, withAltRanks } from '../utils/pattern';
import { LocalSplitTreePair } from './LocalSplitTreePair';

export function EdgeHistogram({ branch }: { branch: BranchRecord }) {
  const { counts, topologyPatterns: patterns } = branch;
  const total = counts.totalLoci || 1;
  const ranked = withAltRanks(patterns);
  const [treeViewKey, setTreeViewKey] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        {ranked.map(({ pattern, altRank }) => {
          if (pattern.count === 0) return null;
          const pct = (pattern.count / total) * 100;
          return (
            <div
              key={pattern.key}
              title={`${patternLabel(branch, pattern, altRank)}: ${pattern.count} (${pct.toFixed(1)}%)`}
              style={{ width: `${pct}%`, background: patternColor(pattern, altRank) }}
            />
          );
        })}
        {counts.missingLoci > 0 && (
          <div
            title={`Missing: ${counts.missingLoci} (${((counts.missingLoci / total) * 100).toFixed(1)}%)`}
            style={{ width: `${(counts.missingLoci / total) * 100}%`, background: MISSING_COLOR }}
          />
        )}
      </div>
      <div className="histogram-legend">
        {ranked.map(
          ({ pattern, altRank }) =>
            pattern.count > 0 && (
              <div key={pattern.key}>
                <div className="histogram-legend-row">
                  <span className="legend-swatch" style={{ background: patternColor(pattern, altRank) }} />
                  <span className="legend-pct">{((pattern.count / total) * 100).toFixed(0)}%</span>
                  <span className="legend-desc">{patternLabel(branch, pattern, altRank)}</span>
                  <span className="legend-count">({pattern.count})</span>
                </div>
                {pattern.refLocalTree && pattern.altLocalTree && (
                  <button
                    className="tree-view-toggle"
                    onClick={() => setTreeViewKey(treeViewKey === pattern.key ? null : pattern.key)}
                  >
                    {treeViewKey === pattern.key ? '▾ hide tree' : '▸ view as tree'}
                  </button>
                )}
                {treeViewKey === pattern.key && pattern.refLocalTree && pattern.altLocalTree && (
                  <LocalSplitTreePair
                    refTree={pattern.refLocalTree}
                    altTree={pattern.altLocalTree}
                    ownTaxa={branch.taxaLeft}
                    moverTaxa={pattern.altMovers}
                  />
                )}
              </div>
            ),
        )}
        {counts.missingLoci > 0 && (
          <div className="histogram-legend-row">
            <span className="legend-swatch" style={{ background: MISSING_COLOR }} />
            <span className="legend-pct">{((counts.missingLoci / total) * 100).toFixed(0)}%</span>
            <span className="legend-desc">Missing taxa</span>
            <span className="legend-count">({counts.missingLoci})</span>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { BranchRecord, Dataset } from '../types';
import { HIDDEN_COLOR, MISSING_COLOR, OTHER_COLOR, UNINFORMATIVE_COLOR } from '../utils/color';
import { orderLabel, orderedLoci, subsample, type LocusOrderMode } from '../utils/locusOrder';
import { patternColor, patternLabel, patternTag, withAltRanks } from '../utils/pattern';

interface BranchLocusTrackProps {
  dataset: Dataset;
  branch: BranchRecord;
  mode: LocusOrderMode;
  maxPoints: number | null;
  metadataColumn: string | null;
  groupByPattern: boolean;
}

export function BranchLocusTrack({ dataset, branch, mode, maxPoints, metadataColumn, groupByPattern }: BranchLocusTrackProps) {
  const ranked = withAltRanks(branch.topologyPatterns);
  const baseNames = orderedLoci(dataset, mode, metadataColumn);

  // Optionally group loci by this branch's own classification (reference,
  // then each alternative by rank, then other/uninformative/missing) -
  // ties broken by the base order above (stable sort), so within a group
  // loci still follow whatever chrom/rank/metadata order was chosen.
  const groupOrder = [...branch.topologyPatterns.map((p) => p.key), 'uninformative', 'missing'];
  const groupRank = new Map(groupOrder.map((k, i) => [k, i]));
  const groupKeyFor = (name: string): string => {
    const key = branch.locusPatternKey[name] ?? 'missing';
    if (key === 'missing' || key === 'uninformative') return key;
    return ranked.some((r) => r.pattern.key === key) ? key : 'other';
  };
  const names = groupByPattern
    ? [...baseNames].sort((a, b) => (groupRank.get(groupKeyFor(a)) ?? Infinity) - (groupRank.get(groupKeyFor(b)) ?? Infinity))
    : baseNames;

  const shown = subsample(names, maxPoints);
  const total = shown.length || 1;
  const subsampled = shown.length < names.length;
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) =>
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const patternFor = (key: string) => ranked.find((r) => r.pattern.key === key);

  const colorFor = (key: string): string => {
    if (key === 'missing') return MISSING_COLOR;
    if (key === 'uninformative') return UNINFORMATIVE_COLOR;
    const found = patternFor(key);
    // A key not present among the named/other patterns is a tail alternative
    // folded into "other" for display - color and label it that way too.
    return found ? patternColor(found.pattern, found.altRank) : OTHER_COLOR;
  };

  const labelFor = (key: string): string => {
    if (key === 'missing') return 'Missing taxa at this branch';
    if (key === 'uninformative') return 'Uninformative - no clear signal for any topology';
    const found = patternFor(key);
    return found ? patternLabel(branch, found.pattern, found.altRank) : 'Other (minor alternative)';
  };

  // Legend toggle groups: named patterns toggle by their own key, everything
  // folded into the visual "other" tail (whether or not it has its own
  // topologyPattern entry) toggles together as one group.
  const groupFor = (key: string): string => {
    if (key === 'missing' || key === 'uninformative') return key;
    const found = patternFor(key);
    return found ? found.pattern.key : 'other';
  };

  return (
    <div className="locus-track">
      <div className="locus-track-header">
        <span className="toolbar-label">
          {branch.branchId} topology, {groupByPattern ? 'grouped by this branch’s pattern' : orderLabel(mode, metadataColumn)}
          {subsampled && ` - showing ${shown.length} of ${names.length} loci`}
        </span>
      </div>
      <svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" width="100%" height="18" className="locus-track-svg">
        {shown.map((name, i) => {
          const key = branch.locusPatternKey[name] ?? 'missing';
          const hidden = hiddenKeys.has(groupFor(key));
          return (
            <rect key={`${name}_${i}`} x={i} y={0} width={1} height={1} fill={hidden ? HIDDEN_COLOR : colorFor(key)}>
              <title>
                {name}: {labelFor(key)}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="locus-track-legend">
        {ranked.map(
          ({ pattern, altRank }) =>
            pattern.count > 0 && (
              <button
                key={pattern.key}
                className={`legend-item legend-toggle${hiddenKeys.has(pattern.key) ? ' legend-toggle-off' : ''}`}
                onClick={() => toggleKey(pattern.key)}
                title={`${patternLabel(branch, pattern, altRank)} - click to show/hide`}
              >
                <span className="legend-swatch" style={{ background: patternColor(pattern, altRank) }} />
                {patternTag(pattern, altRank)}: {pattern.count}
              </button>
            ),
        )}
        {branch.counts.missingLoci > 0 && (
          <button
            className={`legend-item legend-toggle${hiddenKeys.has('missing') ? ' legend-toggle-off' : ''}`}
            onClick={() => toggleKey('missing')}
            title="Missing taxa at this branch - click to show/hide"
          >
            <span className="legend-swatch" style={{ background: MISSING_COLOR }} />
            Missing: {branch.counts.missingLoci}
          </button>
        )}
        {branch.counts.uninformativeLoci > 0 && (
          <button
            className={`legend-item legend-toggle${hiddenKeys.has('uninformative') ? ' legend-toggle-off' : ''}`}
            onClick={() => toggleKey('uninformative')}
            title="Relevant taxa are present, but no clear signal for any topology - click to show/hide"
          >
            <span className="legend-swatch" style={{ background: UNINFORMATIVE_COLOR }} />
            Uninformative: {branch.counts.uninformativeLoci}
          </button>
        )}
      </div>
    </div>
  );
}

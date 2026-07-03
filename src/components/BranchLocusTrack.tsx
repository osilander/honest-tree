import type { BranchRecord, Dataset } from '../types';
import { MISSING_COLOR, OTHER_COLOR } from '../utils/color';
import { orderedLoci, subsample } from '../utils/locusOrder';
import { patternColor, patternLabel, patternTag, withAltRanks } from '../utils/pattern';

interface BranchLocusTrackProps {
  dataset: Dataset;
  branch: BranchRecord;
  mode: 'chrom' | 'sorted';
  maxPoints: number | null;
}

export function BranchLocusTrack({ dataset, branch, mode, maxPoints }: BranchLocusTrackProps) {
  const ranked = withAltRanks(branch.topologyPatterns);
  const names = orderedLoci(dataset, mode);
  const shown = subsample(names, maxPoints);
  const total = shown.length || 1;
  const subsampled = shown.length < names.length;

  const patternFor = (key: string) => ranked.find((r) => r.pattern.key === key);

  const colorFor = (key: string): string => {
    if (key === 'missing') return MISSING_COLOR;
    const found = patternFor(key);
    // A key not present among the named/other patterns is a tail alternative
    // folded into "other" for display - color and label it that way too.
    return found ? patternColor(found.pattern, found.altRank) : OTHER_COLOR;
  };

  const labelFor = (key: string): string => {
    if (key === 'missing') return 'Missing / uninformative at this branch';
    const found = patternFor(key);
    return found ? patternLabel(branch, found.pattern, found.altRank) : 'Other (minor alternative)';
  };

  return (
    <div className="locus-track">
      <div className="locus-track-header">
        <span className="toolbar-label">
          {branch.branchId} topology, {mode === 'chrom' ? 'file order (chromosome position)' : 'sorted by rank'}
          {subsampled && ` - showing ${shown.length} of ${names.length} loci`}
        </span>
      </div>
      <svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" width="100%" height="18" className="locus-track-svg">
        {shown.map((name, i) => {
          const key = branch.locusPatternKey[name] ?? 'missing';
          return (
            <rect key={`${name}_${i}`} x={i} y={0} width={1} height={1} fill={colorFor(key)}>
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
              <span key={pattern.key} className="legend-item" title={patternLabel(branch, pattern, altRank)}>
                <span className="legend-swatch" style={{ background: patternColor(pattern, altRank) }} />
                {patternTag(pattern, altRank)}: {pattern.count}
              </span>
            ),
        )}
        {branch.counts.missingLoci > 0 && (
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: MISSING_COLOR }} />
            Missing: {branch.counts.missingLoci}
          </span>
        )}
      </div>
    </div>
  );
}

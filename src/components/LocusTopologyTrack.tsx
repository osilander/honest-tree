import type { Dataset } from '../types';
import { topologyRankColor } from '../utils/color';
import { orderedLoci, subsample } from '../utils/locusOrder';

interface LocusTopologyTrackProps {
  dataset: Dataset;
  mode: 'chrom' | 'sorted';
  maxPoints: number | null;
}

export function LocusTopologyTrack({ dataset, mode, maxPoints }: LocusTopologyTrackProps) {
  const { locusRank, ranks, maxNamedRank } = dataset.topologyRanking;
  const names = orderedLoci(dataset, mode);
  const loci = names.map((name) => ({ name, rank: locusRank.get(name)! }));

  const shown = subsample(loci, maxPoints);
  const total = shown.length || 1;
  const subsampled = shown.length < loci.length;

  return (
    <div className="locus-track">
      <div className="locus-track-header">
        <span className="toolbar-label">
          {mode === 'chrom' ? 'Locus topology, file order (chromosome position)' : 'Locus topology, sorted by rank'}
          {subsampled && ` - showing ${shown.length} of ${loci.length} loci`}
        </span>
      </div>
      <svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" width="100%" height="18" className="locus-track-svg">
        {shown.map((l, i) => (
          <rect key={`${l.name}_${i}`} x={i} y={0} width={1} height={1} fill={topologyRankColor(l.rank, l.rank > maxNamedRank)}>
            <title>
              {l.name}: rank {l.rank > maxNamedRank ? `${maxNamedRank + 1}+ (other)` : l.rank}
            </title>
          </rect>
        ))}
      </svg>
      <div className="locus-track-legend">
        {ranks.map((r) => (
          <span key={r.rank} className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: topologyRankColor(r.rank, r.isOther) }}
            />
            {r.isOther ? `Other (rank ${maxNamedRank + 1}+)` : `Rank ${r.rank}${r.rank === 1 ? ' (most common)' : ''}`}: {r.count}
          </span>
        ))}
      </div>
    </div>
  );
}

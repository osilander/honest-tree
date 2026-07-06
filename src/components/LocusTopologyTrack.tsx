import { useState } from 'react';
import type { BranchRecord, Dataset } from '../types';
import { HIDDEN_COLOR, topologyRankColor } from '../utils/color';
import { clickHoverHint, orderedLoci, subsample, type LocusSortMode } from '../utils/locusOrder';

interface LocusTopologyTrackProps {
  dataset: Dataset;
  mode: LocusSortMode;
  maxPoints: number | null;
  metadataColumn: string | null;
  branch: BranchRecord | null;
  onHeaderClick: () => void;
}

export function LocusTopologyTrack({ dataset, mode, maxPoints, metadataColumn, branch, onHeaderClick }: LocusTopologyTrackProps) {
  const { locusRank, ranks, maxNamedRank } = dataset.topologyRanking;
  const [hiddenRanks, setHiddenRanks] = useState<Set<number>>(new Set());
  const names = orderedLoci(dataset, mode, metadataColumn, branch);
  const loci = names.map((name) => ({ name, rank: locusRank.get(name)! }));

  const shown = subsample(loci, maxPoints);
  const total = shown.length || 1;
  const subsampled = shown.length < loci.length;
  const active = mode === 'rank';

  const toggleRank = (rank: number) =>
    setHiddenRanks((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });

  return (
    <div className="locus-track">
      <div className="locus-track-header">
        <button className={`locus-track-header-btn${active ? ' locus-track-header-active' : ''}`} onClick={onHeaderClick}>
          Whole-tree topology{clickHoverHint(active, 'sorted by rank', 'loci')}
          {subsampled && ` - showing ${shown.length} of ${loci.length} loci`}
        </button>
      </div>
      <svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" width="100%" height="18" className="locus-track-svg">
        {shown.map((l, i) => (
          <rect
            key={`${l.name}_${i}`}
            x={i}
            y={0}
            width={1}
            height={1}
            fill={hiddenRanks.has(l.rank) ? HIDDEN_COLOR : topologyRankColor(l.rank, l.rank > maxNamedRank)}
          >
            <title>
              {l.name}: rank {l.rank > maxNamedRank ? `${maxNamedRank + 1}+ (other)` : l.rank}
            </title>
          </rect>
        ))}
      </svg>
      <div className="locus-track-legend">
        {ranks.map((r) => (
          <button
            key={r.rank}
            className={`legend-item legend-toggle${hiddenRanks.has(r.rank) ? ' legend-toggle-off' : ''}`}
            onClick={() => toggleRank(r.rank)}
            title="Click to show/hide this topology in the track above"
          >
            <span className="legend-swatch" style={{ background: topologyRankColor(r.rank, r.isOther) }} />
            {r.isOther ? `Other (rank ${maxNamedRank + 1}+)` : `Rank ${r.rank}${r.rank === 1 ? ' (most common)' : ''}`}: {r.count}
          </button>
        ))}
      </div>
    </div>
  );
}

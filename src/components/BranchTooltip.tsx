import type { BranchRecord } from '../types';
import { LengthHistogram } from './LengthHistogram';

export function BranchTooltip({ branch, x, y }: { branch: BranchRecord; x: number; y: number }) {
  return (
    <div className="branch-tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="tooltip-title">{branch.splitId}</div>
      <div>gCF: {branch.support.gcf?.toFixed(1)}%</div>
      <div>
        Concordant/Decisive: {branch.topologyPatterns.find((p) => p.isMain)?.count ?? 0}/{branch.counts.decisiveLoci}
      </div>
      <div>Dominant: {branch.dominantConflict}</div>
      {branch.lengthObservations.length > 0 && (
        <>
          <div className="tooltip-subhead">Where this branch length came from</div>
          <LengthHistogram observations={branch.lengthObservations} />
        </>
      )}
    </div>
  );
}

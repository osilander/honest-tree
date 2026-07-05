import type { BranchRecord, RenderMode, SupportMetricKey } from '../types';
import { getSupportMetricValue } from '../phylo/metrics';
import { NEUTRAL_BRANCH, conflictColor, evidenceColor, scaleOpacity, scaleWidth } from './color';

export interface BranchStyle {
  width: number;
  opacity: number;
  color: string;
}

/** Visual encoding for a branch, per render mode (see tree-browser-readme.md "Render Modes"). */
export function encodeBranch(renderMode: RenderMode, record: BranchRecord | null, metric: SupportMetricKey): BranchStyle {
  if (!record) {
    return { width: 1, opacity: 0.5, color: NEUTRAL_BRANCH };
  }
  const decisiveFraction = record.counts.totalLoci > 0 ? record.counts.decisiveLoci / record.counts.totalLoci : 0;

  switch (renderMode) {
    case 'conflict':
      return {
        width: scaleWidth(1 - record.support.concordantProportion),
        opacity: scaleOpacity(decisiveFraction),
        color: conflictColor(record.dominantConflict, record.support.concordantProportion),
      };
    case 'evidence':
      return {
        width: scaleWidth(decisiveFraction),
        opacity: scaleOpacity(decisiveFraction),
        color: evidenceColor(decisiveFraction),
      };
    case 'support':
    default:
      return {
        width: scaleWidth(getSupportMetricValue(record.support, metric) / 100),
        opacity: scaleOpacity(decisiveFraction),
        color: NEUTRAL_BRANCH,
      };
  }
}

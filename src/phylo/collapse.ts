import type { BranchRecord, RawNode, SupportMetricKey } from '../types';
import { annotateMasks, splitIdFor, type TaxonIndex } from './splits';
import { popcount } from './bitset';
import { getSupportMetricValue } from './metrics';

/**
 * Returns a new tree with every internal branch whose chosen support metric
 * falls below `thresholdPercent` spliced out - its children are promoted
 * directly into its parent's children, turning the parent into a (partial)
 * polytomy. Applied bottom-up so chains of weak branches collapse correctly.
 */
export function collapseWeakBranches(
  root: RawNode,
  branches: Map<string, BranchRecord>,
  index: TaxonIndex,
  metric: SupportMetricKey,
  thresholdPercent: number,
): RawNode {
  const masks = annotateMasks(root, index);

  function rebuild(n: RawNode): RawNode[] {
    if (n.children.length === 0) return [n];
    const rebuiltChildren = n.children.flatMap(rebuild);

    const mask = masks.get(n)!;
    const complement = index.fullMask ^ mask;
    const isBranch = popcount(mask) >= 2 && popcount(complement) >= 2;
    if (isBranch) {
      const splitId = splitIdFor(mask, index.fullMask);
      const record = branches.get(splitId);
      if (record && getSupportMetricValue(record.support, metric) < thresholdPercent) {
        return rebuiltChildren;
      }
    }
    return [{ name: n.name, length: n.length, supportLabel: n.supportLabel, children: rebuiltChildren }];
  }

  return { name: root.name, length: root.length, children: root.children.flatMap(rebuild) };
}

import type { BranchRecord } from '../types';
import type { LayoutEdge } from '../phylo/layout';
import { MISSING_COLOR } from '../utils/color';
import { patternColor, withAltRanks } from '../utils/pattern';

interface ConcordanceSummaryBarsProps {
  edges: LayoutEdge[];
  branches: Map<string, BranchRecord>;
  barHeight: number;
  gap: number;
  selectedBranchId: string | null;
  hoveredBranchId: string | null;
  onHover: (splitId: string | null) => void;
  onSelect: (splitId: string | null) => void;
}

/** A thin stacked bar drawn directly above each branch's own horizontal run,
 * sized to that branch's rendered length - so resolution scales with however
 * much screen space the branch already has, and it never competes visually
 * with the branch's own render-mode color encoding underneath it. */
export function ConcordanceSummaryBars({
  edges,
  branches,
  barHeight,
  gap,
  selectedBranchId,
  hoveredBranchId,
  onHover,
  onSelect,
}: ConcordanceSummaryBarsProps) {
  const rows = edges.filter((e) => e.child.splitId !== null);

  return (
    <g className="concordance-summary">
      {rows.map((edge) => {
        const splitId = edge.child.splitId!;
        const record = branches.get(splitId);
        if (!record) return null;
        const total = record.counts.totalLoci || 1;
        const selected = selectedBranchId !== null && splitId === selectedBranchId;
        const hovered = hoveredBranchId !== null && splitId === hoveredBranchId;

        const x0 = edge.parent.x;
        const barWidth = Math.max(edge.child.x - edge.parent.x, 1);
        const y = edge.child.y - gap - barHeight;

        let cursor = x0;
        const segments = withAltRanks(record.topologyPatterns).map(({ pattern, altRank }) => {
          const w = (pattern.count / total) * barWidth;
          const x = cursor;
          cursor += w;
          return { x, w, color: patternColor(pattern, altRank), value: pattern.count };
        });
        if (record.counts.missingLoci > 0) {
          const w = (record.counts.missingLoci / total) * barWidth;
          segments.push({ x: cursor, w, color: MISSING_COLOR, value: record.counts.missingLoci });
        }

        return (
          <g
            key={edge.child.id}
            onMouseEnter={() => onHover(splitId)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(selected ? null : splitId)}
            style={{ cursor: 'pointer' }}
          >
            {(selected || hovered) && (
              <rect
                x={x0 - 2}
                y={y - 2}
                width={barWidth + 4}
                height={barHeight + 4}
                fill="none"
                stroke={selected ? '#0ea5e9' : '#94a3b8'}
                strokeWidth={1.25}
                rx={2}
              />
            )}
            <rect x={x0} y={y} width={barWidth} height={barHeight} fill="#f1f5f9" />
            {segments.map(
              (seg, i) => seg.value > 0 && <rect key={i} x={seg.x} y={y} width={Math.max(seg.w, 0.4)} height={barHeight} fill={seg.color} />,
            )}
          </g>
        );
      })}
    </g>
  );
}

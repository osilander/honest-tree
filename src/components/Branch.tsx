import type { LayoutEdge } from '../phylo/layout';
import type { BranchStyle } from '../utils/encode';

interface BranchProps {
  edge: LayoutEdge;
  style: BranchStyle;
  selected: boolean;
  hovered: boolean;
  searchHighlighted: boolean;
  onHover: (branchId: string | null) => void;
  onSelect: (branchId: string | null) => void;
}

export function Branch({ edge, style, selected, hovered, searchHighlighted, onHover, onSelect }: BranchProps) {
  const { parent, child } = edge;
  // Vertical first (at parent.x, from parent.y down/up to child.y), then
  // horizontal (at child.y, from parent.x to child.x) - so every edge ends
  // in a horizontal run terminating exactly at the child/leaf, which is what
  // the tip label sits against, and what forms a clean T-junction with the
  // shared vertical spine at each internal node's incoming edge.
  const d = `M ${parent.x},${parent.y} L ${parent.x},${child.y} L ${child.x},${child.y}`;
  const clickable = child.splitId !== null;

  return (
    <g
      className={clickable ? 'branch clickable' : 'branch'}
      data-split-id={child.splitId ?? undefined}
      onMouseEnter={() => clickable && onHover(child.splitId)}
      onMouseLeave={() => onHover(null)}
      onClick={() => clickable && onSelect(selected ? null : child.splitId)}
    >
      {selected && <path d={d} fill="none" stroke="#0ea5e9" strokeWidth={style.width + 6} strokeOpacity={0.35} strokeLinecap="round" />}
      {searchHighlighted && <path d={d} fill="none" stroke="#eab308" strokeWidth={style.width + 6} strokeOpacity={0.45} strokeLinecap="round" />}
      <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(14, style.width)} />
      <path
        d={d}
        fill="none"
        stroke={style.color}
        strokeWidth={hovered ? style.width + 1.5 : style.width}
        strokeOpacity={style.opacity}
        strokeLinecap="round"
      />
    </g>
  );
}

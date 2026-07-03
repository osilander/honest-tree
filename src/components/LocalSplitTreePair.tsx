import type { RawNode } from '../types';
import { ALT_PATTERN_PALETTE, MAIN_PATTERN_COLOR, NEUTRAL_BRANCH } from '../utils/color';

const MOVER_COLOR = ALT_PATTERN_PALETTE[0];
const ROW_H = 16;
const COL_W = 22;
const LABEL_GAP = 6;
const MARGIN = 6;
const TITLE_H = 14;

interface Positioned {
  node: RawNode;
  x: number;
  y: number;
  children: Positioned[];
}

function depthFromTip(n: RawNode): number {
  return n.children.length === 0 ? 0 : 1 + Math.max(...n.children.map(depthFromTip));
}

function layout(root: RawNode): { root: Positioned; leafCount: number; maxDepth: number } {
  const maxDepth = depthFromTip(root);
  let leafIndex = 0;
  function place(n: RawNode): Positioned {
    if (n.children.length === 0) {
      const y = leafIndex * ROW_H;
      leafIndex++;
      return { node: n, x: maxDepth * COL_W, y, children: [] };
    }
    const kids = n.children.map(place);
    const y = kids.reduce((s, k) => s + k.y, 0) / kids.length;
    const x = (maxDepth - depthFromTip(n)) * COL_W;
    return { node: n, x, y, children: kids };
  }
  return { root: place(root), leafCount: leafIndex, maxDepth };
}

function collectEdges(p: Positioned, out: { parent: Positioned; child: Positioned }[] = []) {
  for (const c of p.children) {
    out.push({ parent: p, child: c });
    collectEdges(c, out);
  }
  return out;
}

function collectLeaves(p: Positioned, out: Positioned[] = []) {
  if (p.children.length === 0) out.push(p);
  else p.children.forEach((c) => collectLeaves(c, out));
  return out;
}

function taxonColor(name: string, ownTaxa: Set<string>, moverTaxa: Set<string>): string {
  if (moverTaxa.has(name)) return MOVER_COLOR;
  if (ownTaxa.has(name)) return MAIN_PATTERN_COLOR;
  return NEUTRAL_BRANCH;
}

/** Color for the edge leading to `p`: uniform if every leaf below shares one category, neutral (mixed) otherwise. */
function edgeColor(p: Positioned, ownTaxa: Set<string>, moverTaxa: Set<string>): string {
  const leafColors = new Set(collectLeaves(p).map((l) => taxonColor(l.node.name, ownTaxa, moverTaxa)));
  return leafColors.size === 1 ? [...leafColors][0] : NEUTRAL_BRANCH;
}

function MiniTree({
  tree,
  ownTaxa,
  moverTaxa,
  title,
}: {
  tree: RawNode;
  ownTaxa: Set<string>;
  moverTaxa: Set<string>;
  title: string;
}) {
  const { root, leafCount, maxDepth } = layout(tree);
  const edges = collectEdges(root);
  const leaves = collectLeaves(root);
  const labelWidth = Math.max(...leaves.map((l) => l.node.name.length)) * 6 + LABEL_GAP;
  const width = maxDepth * COL_W + MARGIN * 2 + labelWidth;
  const height = leafCount * ROW_H + MARGIN * 2 + TITLE_H;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="mini-tree-svg">
      <text x={MARGIN} y={TITLE_H - 3} className="mini-tree-title">
        {title}
      </text>
      <g transform={`translate(${MARGIN},${MARGIN + TITLE_H})`}>
        {edges.map((e, i) => (
          <path
            key={i}
            d={`M${e.parent.x},${e.parent.y} L${e.parent.x},${e.child.y} L${e.child.x},${e.child.y}`}
            fill="none"
            stroke={edgeColor(e.child, ownTaxa, moverTaxa)}
            strokeWidth={1.5}
          />
        ))}
        {leaves.map((l, i) => {
          const c = taxonColor(l.node.name, ownTaxa, moverTaxa);
          return (
            <g key={i}>
              <circle cx={l.x} cy={l.y} r={2.5} fill={c} />
              <text x={l.x + LABEL_GAP} y={l.y + 3} className="mini-tree-label" fill={c}>
                {l.node.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function LocalSplitTreePair({
  refTree,
  altTree,
  ownTaxa,
  moverTaxa,
}: {
  refTree: RawNode;
  altTree: RawNode;
  ownTaxa: string[];
  moverTaxa: string[];
}) {
  const own = new Set(ownTaxa);
  const movers = new Set(moverTaxa);
  return (
    <div className="local-split-tree-pair">
      <MiniTree tree={refTree} ownTaxa={own} moverTaxa={movers} title="Reference" />
      <MiniTree tree={altTree} ownTaxa={own} moverTaxa={movers} title="Alternative" />
    </div>
  );
}

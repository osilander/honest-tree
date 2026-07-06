import { forwardRef, useImperativeHandle, useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import type { AppState, BranchRecord, Dataset, LayoutNode } from '../types';
import { computeLayout, collectEdges, collectNodes } from '../phylo/layout';
import { collapseWeakBranches } from '../phylo/collapse';
import { pickSampledTaxa, pruneTaxaForDisplay } from '../phylo/taxonSample';
import { findNodeForSplit, rerootAtNode } from '../phylo/reroot';
import { getSupportMetricValue } from '../phylo/metrics';
import { encodeBranch } from '../utils/encode';
import { normalizeTaxonQuery } from '../utils/search';
import { Branch } from './Branch';
import { BranchTooltip } from './BranchTooltip';
import { ConcordanceSummaryBars } from './ConcordanceSummaryBars';

const LEFT_MARGIN = 24;
const TOP_MARGIN = 28;
const LABEL_MARGIN = 170;
const SUMMARY_BAR_HEIGHT = 5;
const SUMMARY_BAR_GAP = 3;
const MIN_COLUMN_WIDTH = 30;
const MIN_ROW_HEIGHT = 14;
// Fallback pane size for the very first render, before ResizeObserver reports
// the real one - the layout re-flows to the true size a frame later.
const FALLBACK_WIDTH = 900;
const FALLBACK_HEIGHT = 500;

function scaleLayoutInPlace(root: LayoutNode, columnWidth: number, rowHeight: number) {
  (function walk(n: LayoutNode) {
    n.x = LEFT_MARGIN + n.x * columnWidth;
    n.y = TOP_MARGIN + n.y * rowHeight;
    n.children.forEach(walk);
  })(root);
}

export interface HonestTreeHandle {
  resetView: () => void;
  downloadSvg: () => void;
}

interface HonestTreeProps {
  dataset: Dataset;
  appState: AppState;
  onHover: (branchId: string | null) => void;
  onSelect: (branchId: string | null) => void;
}

export const HonestTree = forwardRef<HonestTreeHandle, HonestTreeProps>(function HonestTree(
  { dataset, appState, onHover, onSelect },
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [paneSize, setPaneSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setPaneSize({ width, height });
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  // Re-rooting doesn't change which bipartitions exist (a split's canonical
  // id is always min(mask, complement), independent of root placement), so
  // it can happen first and everything downstream (weak-branch collapsing,
  // taxon sampling, layout) keeps matching branches correctly with no
  // special-casing needed.
  const rerootedRoot = useMemo(() => {
    if (!appState.rerootSplitId) return dataset.referenceTree;
    const target = findNodeForSplit(dataset.referenceTree, dataset.taxonIndex, appState.rerootSplitId);
    return target ? rerootAtNode(dataset.referenceTree, target) : dataset.referenceTree;
  }, [dataset, appState.rerootSplitId]);

  const effectiveRoot = useMemo(() => {
    if (!appState.collapseWeakBranches) return rerootedRoot;
    return collapseWeakBranches(rerootedRoot, dataset.branches, dataset.taxonIndex, appState.supportMetric, appState.threshold);
  }, [rerootedRoot, dataset, appState.collapseWeakBranches, appState.supportMetric, appState.threshold]);

  const sampledTaxa = useMemo(
    () =>
      pickSampledTaxa(
        dataset,
        appState.taxonSampleMode,
        appState.taxonSampleCount,
        appState.taxonSampleMode === 'custom' ? new Set(appState.taxonSampleCustomSet) : undefined,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataset, appState.taxonSampleMode, appState.taxonSampleCount, appState.taxonSampleSeed, appState.taxonSampleCustomSet],
  );

  // Taxa removed here are only hidden from this rendering - recomputing
  // splitIds from scratch on the pruned tree would silently break support
  // lookups for nearly every branch (missing bits for every removed taxon),
  // so pruneTaxaForDisplay carries the original splitId through instead.
  const { displayRoot, splitIdOverride } = useMemo(() => {
    if (appState.taxonSampleMode === 'off') return { displayRoot: effectiveRoot, splitIdOverride: undefined };
    const { root, splitIdOf } = pruneTaxaForDisplay(effectiveRoot, dataset.taxonIndex, new Set(sampledTaxa));
    return { displayRoot: root, splitIdOverride: splitIdOf };
  }, [effectiveRoot, appState.taxonSampleMode, sampledTaxa, dataset.taxonIndex]);

  const rawLayout = useMemo(
    () =>
      computeLayout(
        displayRoot,
        dataset.taxonIndex,
        dataset.branches,
        { useBranchLengths: appState.useBranchLengths },
        splitIdOverride,
      ),
    [displayRoot, dataset, appState.useBranchLengths, splitIdOverride],
  );

  // Fit the tree's own units to whatever pixel space is actually available, in
  // each axis independently, so the diagram always fills the pane rather than
  // being drawn at a fixed px-per-unit scale that may leave it tiny or (if
  // forced to stretch uniformly) distort branch proportions.
  const vbWidth = paneSize?.width ?? FALLBACK_WIDTH;
  const vbHeight = paneSize?.height ?? FALLBACK_HEIGHT;
  const columnWidth = Math.max((vbWidth - LEFT_MARGIN - LABEL_MARGIN) / Math.max(rawLayout.maxX, 1), MIN_COLUMN_WIDTH);
  const rowHeight = Math.max((vbHeight - TOP_MARGIN * 2) / Math.max(rawLayout.maxY, 1), MIN_ROW_HEIGHT);

  const layout = useMemo(() => {
    const cloned = structuredClone(rawLayout) as typeof rawLayout;
    scaleLayoutInPlace(cloned.root, columnWidth, rowHeight);
    return cloned;
  }, [rawLayout, columnWidth, rowHeight]);

  const edges = useMemo(() => collectEdges(layout.root), [layout]);
  const nodes = useMemo(() => collectNodes(layout.root), [layout]);

  const actualHeight = Math.max(layout.maxY * rowHeight + TOP_MARGIN * 2, vbHeight);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 10])
      .on('zoom', (event) => {
        d3.select(gRef.current).attr('transform', event.transform.toString());
      });
    d3.select(svgRef.current).call(zoom);
    zoomRef.current = zoom;
  }, []);

  useImperativeHandle(ref, () => ({
    resetView() {
      if (svgRef.current && zoomRef.current) {
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
      }
    },
    downloadSvg() {
      if (!svgRef.current) return;
      const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
      const rect = svgRef.current.getBoundingClientRect();
      clone.setAttribute('width', String(Math.round(rect.width)));
      clone.setAttribute('height', String(Math.round(rect.height)));
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      let source = new XMLSerializer().serializeToString(clone);
      if (!source.startsWith('<?xml')) source = `<?xml version="1.0" standalone="no"?>\n${source}`;
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'phylo-tree.svg';
      a.click();
      URL.revokeObjectURL(url);
    },
  }));

  const hoveredBranch = appState.hoveredBranchId ? dataset.branches.get(appState.hoveredBranchId) ?? null : null;

  const searchQuery = normalizeTaxonQuery(appState.searchTaxon ?? '');
  const isSearchMatch = (record: BranchRecord | null) =>
    searchQuery.length >= 2 && !!record && record.taxonInstability.some((t) => normalizeTaxonQuery(t.taxon).includes(searchQuery));

  return (
    <div
      className="tree-container"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setMouse(null)}
    >
      <svg ref={svgRef} viewBox={`0 0 ${vbWidth} ${actualHeight}`} width="100%" height="100%">
        <g ref={gRef}>
          {edges.map((edge) => {
            const record = edge.child.splitId ? dataset.branches.get(edge.child.splitId) ?? null : null;
            const style = encodeBranch(appState.renderMode, record, appState.supportMetric);
            style.width *= appState.branchWidthScale;
            return (
              <Branch
                key={edge.child.id}
                edge={edge}
                style={style}
                selected={appState.selectedBranchId !== null && edge.child.splitId === appState.selectedBranchId}
                hovered={appState.hoveredBranchId !== null && edge.child.splitId === appState.hoveredBranchId}
                searchHighlighted={isSearchMatch(record)}
                onHover={onHover}
                onSelect={onSelect}
              />
            );
          })}
          {appState.showSupportValues &&
            edges
              .filter((e) => e.child.splitId !== null)
              .map((e) => {
                const record = dataset.branches.get(e.child.splitId!);
                if (!record) return null;
                const style = encodeBranch(appState.renderMode, record, appState.supportMetric);
                const value = getSupportMetricValue(record.support, appState.supportMetric);
                const clearance = 5 + (style.width * appState.branchWidthScale) / 2;
                const fontSize = Math.max(9, appState.tipLabelSize - 2);
                return (
                  <text
                    key={`sv_${e.child.id}`}
                    x={e.child.x}
                    y={e.child.y + clearance}
                    dominantBaseline="hanging"
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill="#334155"
                    paintOrder="stroke"
                    stroke="#ffffff"
                    strokeWidth={3}
                  >
                    {value.toFixed(0)}
                  </text>
                );
              })}
          {appState.showTipLabels &&
            nodes
              .filter((n) => n.isLeaf)
              .map((n) => {
                const leafMatch = searchQuery.length >= 2 && normalizeTaxonQuery(n.name).includes(searchQuery);
                return (
                  <text
                    key={n.id}
                    x={n.x + 8}
                    y={n.y}
                    dominantBaseline="middle"
                    fontSize={appState.tipLabelSize}
                    fill={leafMatch ? '#92400e' : '#1e293b'}
                    fontWeight={leafMatch ? 700 : 400}
                  >
                    {n.name}
                  </text>
                );
              })}
          {appState.showConcordanceSummary && (
            <ConcordanceSummaryBars
              edges={edges}
              branches={dataset.branches}
              barHeight={SUMMARY_BAR_HEIGHT}
              gap={SUMMARY_BAR_GAP}
              selectedBranchId={appState.selectedBranchId}
              hoveredBranchId={appState.hoveredBranchId}
              onHover={onHover}
              onSelect={onSelect}
            />
          )}
        </g>
      </svg>
      {hoveredBranch && mouse && <BranchTooltip branch={hoveredBranch} x={mouse.x} y={mouse.y} />}
    </div>
  );
});

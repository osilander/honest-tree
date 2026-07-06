import { useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react';
import type { AppState, Dataset, RenderMode } from '../types';
import type { Action } from '../state/store';
import { parseLocusMetadataTable } from '../data/parseLocusMetadata';
import { TreeLegend } from './TreeLegend';

const RENDER_MODES: { value: RenderMode; label: string; title: string }[] = [
  { value: 'support', label: 'Support', title: 'Width = support metric value. Color neutral - "how strongly is the reference topology supported".' },
  { value: 'conflict', label: 'Conflict', title: 'Width = amount of discordance, color = kind of conflict (concentrated/contradicted/diffuse) - "what is wrong, and how".' },
  {
    value: 'evidence',
    label: 'Evidence',
    title: 'Width and color (blue = mostly decisive, yellow = mostly uninformative/missing, grey = almost no usable data) track decisiveness - "how much usable data exists", independent of what it says.',
  },
];

const LOCUS_TRACK_POINT_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All loci' },
  { value: '500', label: '500 sampled loci' },
  { value: '1000', label: '1000 sampled loci' },
  { value: '2000', label: '2000 sampled loci' },
];

function ToolbarDropdown({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const ref = useRef<HTMLDivElement | null>(null);

  // Listener is attached once for the component's whole lifetime (reading
  // `open` via a ref rather than depending on it) rather than being
  // conditionally added/removed every time `open` flips - avoids any chance
  // of a gap between "state says open" and "listener is actually attached".
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!openRef.current) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="toolbar-dropdown" ref={ref}>
      <button className={open ? 'toolbar-dropdown-btn open' : 'toolbar-dropdown-btn'} onClick={() => setOpen((v) => !v)}>
        {label} <span className="toolbar-dropdown-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="toolbar-dropdown-panel">{children}</div>}
    </div>
  );
}

export function Toolbar({
  appState,
  dispatch,
  onResetView,
  onDownloadSvg,
  onPrint,
  taxa,
  dataset,
}: {
  appState: AppState;
  dispatch: Dispatch<Action>;
  onResetView: () => void;
  onDownloadSvg: () => void;
  onPrint: () => void;
  taxa: string[];
  dataset: Dataset;
}) {
  const [metadataMessage, setMetadataMessage] = useState<string | null>(null);
  const metadataFileInputRef = useRef<HTMLInputElement | null>(null);
  const metadataTable = dataset.locusMetadataTable;

  const handleMetadataFile = async (file: File) => {
    try {
      const text = await file.text();
      const knownLoci = new Set(dataset.geneTrees.map((t) => t.name));
      const { table, warnings } = parseLocusMetadataTable(text, knownLoci);
      dispatch({ type: 'SET_LOCUS_METADATA', table });
      setMetadataMessage(
        warnings.length > 0
          ? `Loaded ${table.columns.length} column(s). ${warnings.join(' ')}`
          : `Loaded ${table.columns.length} column(s) for ${table.values.size} loci.`,
      );
    } catch (e) {
      setMetadataMessage((e as Error).message);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Search taxon</span>
        <input
          type="text"
          list="taxa-datalist"
          className="search-input"
          placeholder="e.g. Taxon_16"
          value={appState.searchTaxon ?? ''}
          onChange={(e) => dispatch({ type: 'SET_SEARCH_TAXON', taxon: e.target.value || null })}
        />
        <datalist id="taxa-datalist">
          {taxa.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      <ToolbarDropdown label="Display">
        <div className="toolbar-group">
          <span className="toolbar-label">Render mode</span>
          <div className="radio-row">
            {RENDER_MODES.map((m) => (
              <label key={m.value} className="radio-option" title={m.title}>
                <input
                  type="radio"
                  name="renderMode"
                  checked={appState.renderMode === m.value}
                  onChange={() => dispatch({ type: 'SET_RENDER_MODE', mode: m.value })}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Collapse below: {appState.threshold}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={appState.threshold}
            onChange={(e) => dispatch({ type: 'SET_THRESHOLD', value: Number(e.target.value) })}
          />
          <label className="checkbox-option">
            <input type="checkbox" checked={appState.collapseWeakBranches} onChange={() => dispatch({ type: 'TOGGLE_COLLAPSE' })} />
            Collapse weak branches
          </label>
        </div>
      </ToolbarDropdown>

      <ToolbarDropdown label="Legend">
        <TreeLegend renderMode={appState.renderMode} />
      </ToolbarDropdown>

      <ToolbarDropdown label="Style">
        <div className="toolbar-group">
          <span className="toolbar-label">Text size: {appState.tipLabelSize}px</span>
          <input
            type="range"
            min={7}
            max={20}
            value={appState.tipLabelSize}
            onChange={(e) => dispatch({ type: 'SET_TIP_LABEL_SIZE', value: Number(e.target.value) })}
          />
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Line thickness: {appState.branchWidthScale.toFixed(1)}x</span>
          <input
            type="range"
            min={0.3}
            max={3}
            step={0.1}
            value={appState.branchWidthScale}
            onChange={(e) => dispatch({ type: 'SET_BRANCH_WIDTH_SCALE', value: Number(e.target.value) })}
          />
        </div>

        <div className="toolbar-group toolbar-checks">
          <label className="checkbox-option">
            <input type="checkbox" checked={appState.showTipLabels} onChange={() => dispatch({ type: 'TOGGLE_TIP_LABELS' })} />
            Tip labels
          </label>
          <label className="checkbox-option">
            <input type="checkbox" checked={appState.useBranchLengths} onChange={() => dispatch({ type: 'TOGGLE_BRANCH_LENGTHS' })} />
            Branch lengths
          </label>
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={appState.showSupportValues}
              onChange={() => dispatch({ type: 'TOGGLE_SUPPORT_VALUES' })}
            />
            Support values at nodes
          </label>
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={appState.showConcordanceSummary}
              onChange={() => dispatch({ type: 'TOGGLE_CONCORDANCE_SUMMARY' })}
            />
            Concordance summary (all branches)
          </label>
        </div>
      </ToolbarDropdown>

      <ToolbarDropdown label="Locus tracks">
        <div className="toolbar-group">
          <span className="toolbar-label">Tracks shown</span>
          <div className="toolbar-checks">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={appState.topologyTrackEnabled}
                onChange={(e) => dispatch({ type: 'SET_TOPOLOGY_TRACK_ENABLED', value: e.target.checked })}
              />
              Whole-tree topology
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={appState.branchLocusTrackEnabled}
                onChange={(e) => dispatch({ type: 'SET_BRANCH_LOCUS_TRACK_ENABLED', value: e.target.checked })}
              />
              Branch topology (selected branch)
            </label>
            {metadataTable && (
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={!!appState.metadataTrackColumn}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_METADATA_TRACK_COLUMN',
                      column: e.target.checked ? (appState.metadataTrackColumn ?? metadataTable.columns[0]?.name ?? null) : null,
                    })
                  }
                />
                {appState.metadataTrackColumn ?? 'Metadata'}
              </label>
            )}
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Sort all shown tracks by</span>
          <div className="radio-row">
            <label
              className="radio-option"
              title='The order loci appear in the input tree file. If that file does not encode real chromosome/genomic position, this is not actually chromosomal order - just file order, assumed to reflect it when no positional data is present.'
            >
              <input
                type="radio"
                name="locusSortMode"
                checked={appState.locusSortMode === 'chrom'}
                onChange={() => dispatch({ type: 'SET_LOCUS_SORT_MODE', mode: 'chrom' })}
              />
              File order
            </label>
            <label className="radio-option" title="Rank by frequency of the whole-tree topology each locus displays.">
              <input
                type="radio"
                name="locusSortMode"
                checked={appState.locusSortMode === 'rank'}
                onChange={() => dispatch({ type: 'SET_LOCUS_SORT_MODE', mode: 'rank' })}
              />
              Whole-tree topology rank
            </label>
            {appState.selectedBranchId && (
              <label className="radio-option" title="Group by the selected branch's own classification: reference, then each alternative, then uninformative/missing.">
                <input
                  type="radio"
                  name="locusSortMode"
                  checked={appState.locusSortMode === 'branchPattern'}
                  onChange={() => dispatch({ type: 'SET_LOCUS_SORT_MODE', mode: 'branchPattern' })}
                />
                Branch topology
              </label>
            )}
            {appState.metadataTrackColumn && (
              <label className="radio-option" title={`Sort by ${appState.metadataTrackColumn} - numeric columns ascending, categorical columns grouped by most common first.`}>
                <input
                  type="radio"
                  name="locusSortMode"
                  checked={appState.locusSortMode === 'metadata'}
                  onChange={() => dispatch({ type: 'SET_LOCUS_SORT_MODE', mode: 'metadata' })}
                />
                {appState.metadataTrackColumn} value
              </label>
            )}
          </div>
        </div>

        {(appState.topologyTrackEnabled || appState.branchLocusTrackEnabled || appState.metadataTrackColumn) && (
          <div className="toolbar-group">
            <span className="toolbar-label">Track resolution</span>
            <select
              value={appState.locusTrackMaxPoints === null ? 'all' : String(appState.locusTrackMaxPoints)}
              onChange={(e) =>
                dispatch({ type: 'SET_LOCUS_TRACK_MAX_POINTS', value: e.target.value === 'all' ? null : Number(e.target.value) })
              }
            >
              {LOCUS_TRACK_POINT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="toolbar-group toolbar-metadata-group">
          <span className="toolbar-label">Locus metadata (optional)</span>
          <p className="dropzone-hint toolbar-metadata-hint">
            Upload a TSV (or CSV): first column = locus name, matched by name not row order, so any order/subset is fine - other columns =
            values such as %GC or other locus, alignment, or tree characteristics. For a plain multi-tree Newick input, locus names are
            "locus_1", "locus_2", … in file order (Newick has no way to name a tree); for NEXUS input, it's whatever name follows "tree" in
            your file.
          </p>
          <button className="reset-view-btn" onClick={() => metadataFileInputRef.current?.click()}>
            {metadataTable ? 'Replace metadata file…' : 'Upload metadata file…'}
          </button>
          <input
            ref={metadataFileInputRef}
            type="file"
            accept=".tsv,.csv,.txt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleMetadataFile(file);
            }}
          />
          {metadataMessage && <p className="dropzone-hint toolbar-metadata-hint">{metadataMessage}</p>}

          {metadataTable && (
            <>
              <span className="toolbar-label">Metadata track column</span>
              <select
                value={appState.metadataTrackColumn ?? 'off'}
                onChange={(e) => dispatch({ type: 'SET_METADATA_TRACK_COLUMN', column: e.target.value === 'off' ? null : e.target.value })}
              >
                <option value="off">Off</option>
                {metadataTable.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.kind})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </ToolbarDropdown>

      <ToolbarDropdown label="Taxon sampler">
        <div className="toolbar-group">
          <span className="toolbar-label">Taxon sampler</span>
          <div className="radio-row">
            <label className="radio-option">
              <input
                type="radio"
                name="taxonSampleMode"
                checked={appState.taxonSampleMode === 'off'}
                onChange={() => dispatch({ type: 'SET_TAXON_SAMPLE_MODE', mode: 'off' })}
              />
              All taxa
            </label>
            <label className="radio-option" title="Draw an unbiased random subset - a sanity check against the 'most diverged' selection.">
              <input
                type="radio"
                name="taxonSampleMode"
                checked={appState.taxonSampleMode === 'random'}
                onChange={() => dispatch({ type: 'SET_TAXON_SAMPLE_MODE', mode: 'random' })}
              />
              Random
            </label>
            <label
              className="radio-option"
              title="Keep the taxa on the longest terminal branches - the most phylogenetically distinct - and drop short, near-duplicate branches first."
            >
              <input
                type="radio"
                name="taxonSampleMode"
                checked={appState.taxonSampleMode === 'diverged'}
                onChange={() => dispatch({ type: 'SET_TAXON_SAMPLE_MODE', mode: 'diverged' })}
              />
              Most diverged
            </label>
            <label className="radio-option" title="Pick specific taxa by name instead of a count-based rule.">
              <input
                type="radio"
                name="taxonSampleMode"
                checked={appState.taxonSampleMode === 'custom'}
                onChange={() => dispatch({ type: 'SET_TAXON_SAMPLE_MODE', mode: 'custom' })}
              />
              Select taxa to include
            </label>
          </div>
        </div>

        {appState.taxonSampleMode !== 'off' && appState.taxonSampleMode !== 'custom' && (
          <div className="toolbar-group">
            <span className="toolbar-label">Taxa to show</span>
            <div className="radio-row">
              <input
                type="number"
                className="taxon-count-input"
                min={2}
                max={taxa.length}
                value={appState.taxonSampleCount}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_TAXON_SAMPLE_COUNT',
                    value: Math.max(2, Math.min(taxa.length, Number(e.target.value) || 2)),
                  })
                }
              />
              {appState.taxonSampleMode === 'random' && (
                <button className="reset-view-btn" onClick={() => dispatch({ type: 'RESAMPLE_TAXA' })}>
                  Resample
                </button>
              )}
            </div>
          </div>
        )}

        {appState.taxonSampleMode === 'custom' && (
          <div className="toolbar-group">
            <span className="toolbar-label">
              Taxa to include ({appState.taxonSampleCustomSet.length} of {taxa.length})
            </span>
            <div className="radio-row">
              <button className="reset-view-btn" onClick={() => dispatch({ type: 'SET_CUSTOM_TAXA', taxa: [...taxa] })}>
                Select all
              </button>
              <button className="reset-view-btn" onClick={() => dispatch({ type: 'SET_CUSTOM_TAXA', taxa: [] })}>
                Clear
              </button>
            </div>
            <div className="taxon-checklist">
              {[...taxa]
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                .map((t) => (
                  <label key={t} className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={appState.taxonSampleCustomSet.includes(t)}
                      onChange={() => dispatch({ type: 'TOGGLE_CUSTOM_TAXON', taxon: t })}
                    />
                    {t}
                  </label>
                ))}
            </div>
          </div>
        )}
      </ToolbarDropdown>

      <ToolbarDropdown label="Export">
        <div className="toolbar-group">
          <button className="reset-view-btn" onClick={onDownloadSvg}>
            Download SVG
          </button>
          <button className="reset-view-btn" onClick={onPrint}>
            Print / Save as PDF
          </button>
        </div>
      </ToolbarDropdown>

      <div className="toolbar-group toolbar-actions">
        <button className="reset-view-btn" onClick={onResetView}>
          Reset view
        </button>
        {appState.rerootSplitId && (
          <button
            className="reset-view-btn"
            onClick={() => dispatch({ type: 'SET_REROOT_SPLIT', splitId: null })}
            title="Rerooted at a branch - click to restore the original rooting"
          >
            Rerooted — reset root
          </button>
        )}
      </div>
    </div>
  );
}

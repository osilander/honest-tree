import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './state/store';
import { Dropzone } from './components/Dropzone';
import { Toolbar } from './components/Toolbar';
import { HonestTree, type HonestTreeHandle } from './components/HonestTree';
import { BranchEvidencePanel } from './components/BranchEvidencePanel';
import { LocusTopologyTrack } from './components/LocusTopologyTrack';
import { BranchLocusTrack } from './components/BranchLocusTrack';
import { LocusMetadataTrack } from './components/LocusMetadataTrack';
import { TaxonSummaryPanel } from './components/TaxonSummaryPanel';
import { LoadingOverlay } from './components/LoadingOverlay';
import { MethodsPopover } from './components/MethodsPopover';
import { pickSampledTaxa } from './phylo/taxonSample';

function App() {
  const { state, dispatch } = useStore();
  const treeRef = useRef<HonestTreeHandle>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [warningsDismissed, setWarningsDismissed] = useState(false);

  useEffect(() => {
    setWarningsOpen(false);
    setWarningsDismissed(false);
  }, [state.dataset]);

  const selectedBranch =
    state.dataset && state.app.selectedBranchId ? state.dataset.branches.get(state.app.selectedBranchId) ?? null : null;

  // Computed once here (rather than separately in each consumer) so every
  // panel agrees on exactly which taxa are visible - 'random' mode draws are
  // unseeded, so calling pickSampledTaxa twice could otherwise pick two
  // different subsets for the tree vs. the evidence panel.
  const sampledTaxa = useMemo(() => {
    if (!state.dataset) return null;
    return pickSampledTaxa(
      state.dataset,
      state.app.taxonSampleMode,
      state.app.taxonSampleCount,
      state.app.taxonSampleMode === 'custom' ? new Set(state.app.taxonSampleCustomSet) : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.dataset,
    state.app.taxonSampleMode,
    state.app.taxonSampleCount,
    state.app.taxonSampleSeed,
    state.app.taxonSampleCustomSet,
  ]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Phylogenetic Uncertainty Browser</h1>
        {state.dataset && (
          <span className="dataset-summary">
            {state.dataset.taxa.length} taxa · {state.dataset.geneTrees.length} loci · {state.dataset.branches.size} branches ·{' '}
            {state.dataset.referenceTreeSource === 'user' ? (
              <span title={`Reference tree supplied by you: ${state.dataset.referenceTreeFileName}`}>
                reference: {state.dataset.referenceTreeFileName}
              </span>
            ) : (
              <span title="Reference tree built here via greedy compatible-splits consensus over your gene trees.">
                reference: greedy consensus
              </span>
            )}
          </span>
        )}
        <MethodsPopover />
      </header>

      {state.loadError && <div className="error-banner">{state.loadError}</div>}

      {state.dataset && state.dataset.warnings.length > 0 && !warningsDismissed && (
        <div className="warnings-banner">
          <div className="warnings-banner-row">
            <button onClick={() => setWarningsOpen((v) => !v)}>
              {warningsOpen ? 'Hide' : 'Show'} {state.dataset.warnings.length} data warning(s)
            </button>
            <button className="warnings-dismiss" onClick={() => setWarningsDismissed(true)} title="Dismiss" aria-label="Dismiss warnings">
              ×
            </button>
          </div>
          {warningsOpen && (
            <ul>
              {state.dataset.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.dataset && (
        <Toolbar
          appState={state.app}
          dispatch={dispatch}
          onResetView={() => treeRef.current?.resetView()}
          onDownloadSvg={() => treeRef.current?.downloadSvg()}
          onPrint={() => window.print()}
          taxa={state.dataset.taxa}
          dataset={state.dataset}
        />
      )}

      <div className="main-grid">
        <div className="tree-panel">
          {state.dataset && sampledTaxa ? (
            <HonestTree
              ref={treeRef}
              dataset={state.dataset}
              appState={state.app}
              sampledTaxa={sampledTaxa}
              onHover={(id) => dispatch({ type: 'HOVER_BRANCH', branchId: id })}
              onSelect={(id) => dispatch({ type: 'SELECT_BRANCH', branchId: id })}
            />
          ) : (
            <div className="tree-placeholder" />
          )}
        </div>
        <div className="evidence-panel-container">
          {!selectedBranch && state.dataset && state.app.searchTaxon ? (
            <TaxonSummaryPanel
              dataset={state.dataset}
              query={state.app.searchTaxon}
              visibleTaxa={sampledTaxa}
              onSelectBranch={(splitId) => dispatch({ type: 'SELECT_BRANCH', branchId: splitId })}
            />
          ) : (
            <BranchEvidencePanel
              branch={selectedBranch}
              dataset={state.dataset}
              metadataColumn={state.app.metadataTrackColumn}
              missingBreakdownOpen={state.app.missingBreakdownOpen}
              onToggleMissingBreakdown={() => dispatch({ type: 'TOGGLE_MISSING_BREAKDOWN' })}
              isRerootedHere={!!selectedBranch && state.app.rerootSplitId === selectedBranch.splitId}
              onRerootHere={() => selectedBranch && dispatch({ type: 'SET_REROOT_SPLIT', splitId: selectedBranch.splitId })}
              onResetRoot={() => dispatch({ type: 'SET_REROOT_SPLIT', splitId: null })}
              visibleTaxa={sampledTaxa}
            />
          )}
        </div>
      </div>

      {state.dataset &&
        (state.app.topologyTrackEnabled ||
          (state.app.branchLocusTrackEnabled && selectedBranch) ||
          (state.app.metadataTrackColumn && state.dataset.locusMetadataTable)) && (
          <>
            {state.app.branchLocusTrackEnabled && selectedBranch && (
              <BranchLocusTrack
                dataset={state.dataset}
                branch={selectedBranch}
                mode={state.app.locusSortMode}
                maxPoints={state.app.locusTrackMaxPoints}
                metadataColumn={state.app.metadataTrackColumn}
              />
            )}
            {state.app.topologyTrackEnabled && (
              <LocusTopologyTrack
                dataset={state.dataset}
                mode={state.app.locusSortMode}
                maxPoints={state.app.locusTrackMaxPoints}
                metadataColumn={state.app.metadataTrackColumn}
                branch={selectedBranch}
              />
            )}
            {state.app.metadataTrackColumn && state.dataset.locusMetadataTable && (
              <LocusMetadataTrack
                dataset={state.dataset}
                mode={state.app.locusSortMode}
                maxPoints={state.app.locusTrackMaxPoints}
                column={state.app.metadataTrackColumn}
                branch={selectedBranch}
              />
            )}
          </>
        )}

      <Dropzone hasDataset={!!state.dataset} dispatch={dispatch} />
      {state.loading && <LoadingOverlay />}
    </div>
  );
}

export default App;

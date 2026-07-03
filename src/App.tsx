import { useRef, useState } from 'react';
import { useStore } from './state/store';
import { Dropzone } from './components/Dropzone';
import { Toolbar } from './components/Toolbar';
import { HonestTree, type HonestTreeHandle } from './components/HonestTree';
import { BranchEvidencePanel } from './components/BranchEvidencePanel';
import { LocusTopologyTrack } from './components/LocusTopologyTrack';
import { BranchLocusTrack } from './components/BranchLocusTrack';
import { TaxonSummaryPanel } from './components/TaxonSummaryPanel';
import { LoadingOverlay } from './components/LoadingOverlay';

function App() {
  const { state, dispatch } = useStore();
  const treeRef = useRef<HonestTreeHandle>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);

  const selectedBranch =
    state.dataset && state.app.selectedBranchId ? state.dataset.branches.get(state.app.selectedBranchId) ?? null : null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Phylogenetic Uncertainty Browser</h1>
        {state.dataset && (
          <span className="dataset-summary">
            {state.dataset.taxa.length} taxa · {state.dataset.geneTrees.length} loci · {state.dataset.branches.size} branches
          </span>
        )}
      </header>

      {state.loadError && <div className="error-banner">{state.loadError}</div>}

      {state.dataset && state.dataset.warnings.length > 0 && (
        <div className="warnings-banner">
          <button onClick={() => setWarningsOpen((v) => !v)}>
            {warningsOpen ? 'Hide' : 'Show'} {state.dataset.warnings.length} data warning(s)
          </button>
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
        />
      )}

      <div className="main-grid">
        <div className="tree-panel">
          {state.dataset ? (
            <HonestTree
              ref={treeRef}
              dataset={state.dataset}
              appState={state.app}
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
              onSelectBranch={(splitId) => dispatch({ type: 'SELECT_BRANCH', branchId: splitId })}
            />
          ) : (
            <BranchEvidencePanel
              branch={selectedBranch}
              missingBreakdownOpen={state.app.missingBreakdownOpen}
              onToggleMissingBreakdown={() => dispatch({ type: 'TOGGLE_MISSING_BREAKDOWN' })}
              isRerootedHere={!!selectedBranch && state.app.rerootSplitId === selectedBranch.splitId}
              onRerootHere={() => selectedBranch && dispatch({ type: 'SET_REROOT_SPLIT', splitId: selectedBranch.splitId })}
              onResetRoot={() => dispatch({ type: 'SET_REROOT_SPLIT', splitId: null })}
            />
          )}
        </div>
      </div>

      {state.dataset && (state.app.locusTrackMode !== 'off' || (state.app.branchLocusTrackEnabled && selectedBranch)) && (
        <>
          {state.app.branchLocusTrackEnabled && selectedBranch && (
            <BranchLocusTrack
              dataset={state.dataset}
              branch={selectedBranch}
              mode={state.app.locusTrackMode === 'off' ? 'chrom' : state.app.locusTrackMode}
              maxPoints={state.app.locusTrackMaxPoints}
            />
          )}
          {state.app.locusTrackMode !== 'off' && (
            <LocusTopologyTrack dataset={state.dataset} mode={state.app.locusTrackMode} maxPoints={state.app.locusTrackMaxPoints} />
          )}
        </>
      )}

      <Dropzone hasDataset={!!state.dataset} dispatch={dispatch} />
      {state.loading && <LoadingOverlay />}
    </div>
  );
}

export default App;

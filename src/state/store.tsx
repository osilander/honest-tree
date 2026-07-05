import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState, Dataset, LocusMetadataTable, RenderMode, SupportMetricKey } from '../types';

export interface StoreState {
  dataset: Dataset | null;
  loadError: string | null;
  loading: boolean;
  app: AppState;
}

const initialAppState: AppState = {
  selectedBranchId: null,
  hoveredBranchId: null,
  renderMode: 'conflict',
  supportMetric: 'gcf',
  threshold: 50,
  collapseWeakBranches: false,
  showTipLabels: true,
  useBranchLengths: true,
  showConcordanceSummary: true,
  matrixVisible: false,
  barcodeSort: 'input_order',
  tipLabelSize: 11,
  branchWidthScale: 1,
  showSupportValues: false,
  locusTrackMode: 'chrom',
  locusTrackMaxPoints: null,
  branchLocusTrackEnabled: true,
  taxonSampleMode: 'off',
  taxonSampleCount: 15,
  taxonSampleSeed: 0,
  rerootSplitId: null,
  searchTaxon: null,
  missingBreakdownOpen: false,
  metadataTrackColumn: null,
};

const initialState: StoreState = {
  dataset: null,
  loadError: null,
  loading: false,
  app: initialAppState,
};

export type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_DATASET'; dataset: Dataset }
  | { type: 'LOAD_ERROR'; message: string }
  | { type: 'SELECT_BRANCH'; branchId: string | null }
  | { type: 'HOVER_BRANCH'; branchId: string | null }
  | { type: 'SET_RENDER_MODE'; mode: RenderMode }
  | { type: 'SET_SUPPORT_METRIC'; metric: SupportMetricKey }
  | { type: 'SET_THRESHOLD'; value: number }
  | { type: 'TOGGLE_COLLAPSE' }
  | { type: 'TOGGLE_TIP_LABELS' }
  | { type: 'TOGGLE_BRANCH_LENGTHS' }
  | { type: 'TOGGLE_CONCORDANCE_SUMMARY' }
  | { type: 'SET_TIP_LABEL_SIZE'; value: number }
  | { type: 'SET_BRANCH_WIDTH_SCALE'; value: number }
  | { type: 'TOGGLE_SUPPORT_VALUES' }
  | { type: 'SET_LOCUS_TRACK_MODE'; mode: 'off' | 'chrom' | 'sorted' }
  | { type: 'SET_LOCUS_TRACK_MAX_POINTS'; value: number | null }
  | { type: 'SET_BRANCH_LOCUS_TRACK_ENABLED'; value: boolean }
  | { type: 'SET_TAXON_SAMPLE_MODE'; mode: 'off' | 'random' | 'diverged' }
  | { type: 'SET_TAXON_SAMPLE_COUNT'; value: number }
  | { type: 'RESAMPLE_TAXA' }
  | { type: 'SET_SEARCH_TAXON'; taxon: string | null }
  | { type: 'TOGGLE_MISSING_BREAKDOWN' }
  | { type: 'SET_REROOT_SPLIT'; splitId: string | null }
  | { type: 'SET_LOCUS_METADATA'; table: LocusMetadataTable | null }
  | { type: 'SET_METADATA_TRACK_COLUMN'; column: string | null };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, loadError: null };
    case 'LOAD_DATASET':
      return { ...state, dataset: action.dataset, loadError: null, loading: false, app: { ...initialAppState } };
    case 'LOAD_ERROR':
      return { ...state, loadError: action.message, loading: false };
    case 'SELECT_BRANCH':
      return { ...state, app: { ...state.app, selectedBranchId: action.branchId, missingBreakdownOpen: false } };
    case 'HOVER_BRANCH':
      return { ...state, app: { ...state.app, hoveredBranchId: action.branchId } };
    case 'SET_RENDER_MODE':
      return { ...state, app: { ...state.app, renderMode: action.mode } };
    case 'SET_SUPPORT_METRIC':
      return { ...state, app: { ...state.app, supportMetric: action.metric } };
    case 'SET_THRESHOLD':
      return { ...state, app: { ...state.app, threshold: action.value } };
    case 'TOGGLE_COLLAPSE':
      return { ...state, app: { ...state.app, collapseWeakBranches: !state.app.collapseWeakBranches } };
    case 'TOGGLE_TIP_LABELS':
      return { ...state, app: { ...state.app, showTipLabels: !state.app.showTipLabels } };
    case 'TOGGLE_BRANCH_LENGTHS':
      return { ...state, app: { ...state.app, useBranchLengths: !state.app.useBranchLengths } };
    case 'TOGGLE_CONCORDANCE_SUMMARY':
      return { ...state, app: { ...state.app, showConcordanceSummary: !state.app.showConcordanceSummary } };
    case 'SET_TIP_LABEL_SIZE':
      return { ...state, app: { ...state.app, tipLabelSize: action.value } };
    case 'SET_BRANCH_WIDTH_SCALE':
      return { ...state, app: { ...state.app, branchWidthScale: action.value } };
    case 'TOGGLE_SUPPORT_VALUES':
      return { ...state, app: { ...state.app, showSupportValues: !state.app.showSupportValues } };
    case 'SET_LOCUS_TRACK_MODE':
      return { ...state, app: { ...state.app, locusTrackMode: action.mode } };
    case 'SET_LOCUS_TRACK_MAX_POINTS':
      return { ...state, app: { ...state.app, locusTrackMaxPoints: action.value } };
    case 'SET_BRANCH_LOCUS_TRACK_ENABLED':
      return { ...state, app: { ...state.app, branchLocusTrackEnabled: action.value } };
    case 'SET_TAXON_SAMPLE_MODE':
      return { ...state, app: { ...state.app, taxonSampleMode: action.mode } };
    case 'SET_TAXON_SAMPLE_COUNT':
      return { ...state, app: { ...state.app, taxonSampleCount: action.value } };
    case 'RESAMPLE_TAXA':
      return { ...state, app: { ...state.app, taxonSampleSeed: state.app.taxonSampleSeed + 1 } };
    case 'SET_SEARCH_TAXON':
      return { ...state, app: { ...state.app, searchTaxon: action.taxon } };
    case 'TOGGLE_MISSING_BREAKDOWN':
      return { ...state, app: { ...state.app, missingBreakdownOpen: !state.app.missingBreakdownOpen } };
    case 'SET_REROOT_SPLIT':
      return { ...state, app: { ...state.app, rerootSplitId: action.splitId } };
    case 'SET_LOCUS_METADATA':
      return state.dataset
        ? { ...state, dataset: { ...state.dataset, locusMetadataTable: action.table }, app: { ...state.app, metadataTrackColumn: null } }
        : state;
    case 'SET_METADATA_TRACK_COLUMN':
      return { ...state, app: { ...state.app, metadataTrackColumn: action.column } };
    default:
      return state;
  }
}

const StoreContext = createContext<{ state: StoreState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

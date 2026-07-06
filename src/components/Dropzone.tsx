import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { loadDatasetFromText } from '../data/loadDataset';
import { parseLocusMetadataTable } from '../data/parseLocusMetadata';
import type { Action } from '../state/store';

const SAMPLE_DATASETS: { file: string; label: string; refFile?: string; metadataFile?: string }[] = [
  {
    file: 'mammal-sample-all-cds.nex',
    label: 'Chen et al. (2017) Laurasiatheria — 22 taxa, 1000 loci',
    refFile: 'mammal-sample-all-cds-reference.nwk',
    metadataFile: 'mammal-cds-locus-metadata.tsv',
  },
  {
    file: 'diatoms-sample-cds12.nex',
    label: 'Roberts et al. (2023) diatoms — 86 taxa, 400 loci',
    refFile: 'diatoms-sample-cds12-reference.nwk',
    metadataFile: 'diatoms-cds12-locus-metadata.tsv',
  },
  {
    file: 'aphididae-sample.nex',
    label: 'Owen & Miller (2022) Aphididae — 51 taxa, 500 loci',
    metadataFile: 'aphididae-locus-metadata.tsv',
  },
  { file: 'synthetic_25taxa_500loci.nwk', label: 'Synthetic — 25 taxa, 500 loci', refFile: 'synthetic_25taxa_500loci-reference.nwk' },
  { file: 'synthetic_25taxa_5000loci.nwk', label: 'Synthetic — 25 taxa, 5000 loci', refFile: 'synthetic_25taxa_5000loci-reference.nwk' },
  { file: 'synthetic_50taxa_500loci.nwk', label: 'Synthetic — 50 taxa, 500 loci', refFile: 'synthetic_50taxa_500loci-reference.nwk' },
  { file: 'synthetic_50taxa_5000loci.nwk', label: 'Synthetic — 50 taxa, 5000 loci', refFile: 'synthetic_50taxa_5000loci-reference.nwk' },
];

export function Dropzone({ hasDataset, dispatch }: { hasDataset: boolean; dispatch: Dispatch<Action> }) {
  const [dragging, setDragging] = useState(false);
  const [sampleChoice, setSampleChoice] = useState(SAMPLE_DATASETS[0].file);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [refTree, setRefTree] = useState<{ text: string; name: string } | null>(null);
  const [useSampleRef, setUseSampleRef] = useState(false);
  const [useSampleMetadata, setUseSampleMetadata] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFromText = useCallback(
    // refOverride === undefined means "use whatever's in the refTree state" (the
    // manually-uploaded file, if any); pass an explicit object/null to override
    // that for one call, e.g. when a sample's own prebuilt reference is used instead.
    (text: string, name: string, refOverride?: { text: string; name: string } | null, metadataText?: string) => {
      const ref = refOverride !== undefined ? refOverride : refTree;
      dispatch({ type: 'LOAD_START' });
      // loadDatasetFromText is synchronous and can block the main thread for
      // 20-30s+ on large datasets - defer it two animation frames so the
      // "loading" state we just dispatched actually gets painted first,
      // rather than the browser freezing before ever showing it.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const dataset = loadDatasetFromText(text, name, ref?.text, ref?.name);
            dispatch({ type: 'LOAD_DATASET', dataset });
            if (metadataText) {
              try {
                const knownLoci = new Set(dataset.geneTrees.map((t) => t.name));
                const { table } = parseLocusMetadataTable(metadataText, knownLoci);
                dispatch({ type: 'SET_LOCUS_METADATA', table });
              } catch (e) {
                console.warn('Prebuilt sample metadata failed to parse:', (e as Error).message);
              }
            }
          } catch (e) {
            dispatch({ type: 'LOAD_ERROR', message: (e as Error).message });
          }
        });
      });
    },
    [dispatch, refTree],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      loadFromText(text, file.name);
    },
    [loadFromText],
  );

  const handleRefFile = useCallback(async (file: File) => {
    const text = await file.text();
    setRefTree({ text, name: file.name });
  }, []);

  const handleLoadSample = useCallback(async () => {
    setSampleLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample-data/${sampleChoice}`);
      if (!res.ok) throw new Error(`Could not fetch sample dataset (${res.status})`);
      const text = await res.text();

      const sample = SAMPLE_DATASETS.find((s) => s.file === sampleChoice);

      let metadataText: string | undefined;
      if (useSampleMetadata && sample?.metadataFile) {
        const metaRes = await fetch(`${import.meta.env.BASE_URL}sample-data/${sample.metadataFile}`);
        if (!metaRes.ok) throw new Error(`Could not fetch sample metadata (${metaRes.status})`);
        metadataText = await metaRes.text();
      }

      if (useSampleRef && sample?.refFile) {
        const refRes = await fetch(`${import.meta.env.BASE_URL}sample-data/${sample.refFile}`);
        if (!refRes.ok) throw new Error(`Could not fetch sample reference tree (${refRes.status})`);
        const refText = await refRes.text();
        loadFromText(text, sampleChoice, { text: refText, name: sample.refFile }, metadataText);
      } else {
        loadFromText(text, sampleChoice, undefined, metadataText);
      }
    } catch (e) {
      dispatch({ type: 'LOAD_ERROR', message: (e as Error).message });
    } finally {
      setSampleLoading(false);
    }
  }, [sampleChoice, useSampleRef, useSampleMetadata, loadFromText, dispatch]);

  useEffect(() => {
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      setDragging(true);
    }
    function onDragLeave(e: DragEvent) {
      if (e.relatedTarget === null) setDragging(false);
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    }
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFile]);

  if (!hasDataset) {
    return (
      <div className={dragging ? 'dropzone-overlay dragging' : 'dropzone-overlay'}>
        <div className="dropzone-box">
          <p>Drag and drop a multi-tree Newick or NEXUS file here</p>
          <p className="dropzone-hint">(a set of gene trees - one tree per line, or a NEXUS trees block)</p>
          <button onClick={() => fileInputRef.current?.click()}>Choose file…</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".nwk,.newick,.tree,.trees,.nex,.nexus,.txt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="dropzone-sample">
            <p className="dropzone-hint">Or try a sample dataset:</p>
            <div className="dropzone-sample-row">
              <select value={sampleChoice} onChange={(e) => setSampleChoice(e.target.value)}>
                {SAMPLE_DATASETS.map((s) => (
                  <option key={s.file} value={s.file}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button onClick={handleLoadSample} disabled={sampleLoading}>
                {sampleLoading ? 'Loading…' : 'Load'}
              </button>
            </div>
            {SAMPLE_DATASETS.find((s) => s.file === sampleChoice)?.refFile && (
              <label className="dropzone-sample-refcheck">
                <input type="checkbox" checked={useSampleRef} onChange={(e) => setUseSampleRef(e.target.checked)} />
                Use its prebuilt reference tree instead of the default consensus (built from a random half of its gene
                trees - an independent, but not "true", reconstruction)
              </label>
            )}
            {SAMPLE_DATASETS.find((s) => s.file === sampleChoice)?.metadataFile && (
              <label className="dropzone-sample-refcheck">
                <input type="checkbox" checked={useSampleMetadata} onChange={(e) => setUseSampleMetadata(e.target.checked)} />
                Also load its prebuilt per-locus metadata (alignment length, GC%, informative sites, subset bucket
                membership from the source paper)
              </label>
            )}
          </div>
          <div className="dropzone-reftree">
            <p className="dropzone-hint">
              Optional: supply your own reference tree (e.g. a species-tree estimate) instead of building one from these
              gene trees. It must contain every taxon that appears in any of your gene trees, and no others - individual
              gene trees are still allowed to have missing taxa.
            </p>
            {refTree ? (
              <div className="dropzone-reftree-row">
                <span className="dropzone-reftree-name">✓ {refTree.name}</span>
                <button onClick={() => setRefTree(null)}>Remove</button>
              </div>
            ) : (
              <button onClick={() => refFileInputRef.current?.click()}>Choose reference tree file…</button>
            )}
            <input
              ref={refFileInputRef}
              type="file"
              accept=".nwk,.newick,.tree,.trees,.nex,.nexus,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRefFile(file);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return dragging ? (
    <div className="dropzone-overlay dragging replace-hint">
      <div className="dropzone-box">
        <p>Drop to load a new tree file</p>
      </div>
    </div>
  ) : null;
}

import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { loadDatasetFromText } from '../data/loadDataset';
import type { Action } from '../state/store';

const SAMPLE_DATASETS: { file: string; label: string }[] = [
  { file: 'mammal-sample-all-cds.nwk', label: 'Real — mammal CDS gene trees, 22 taxa, 1000 loci' },
  { file: 'synthetic_25taxa_500loci.nwk', label: 'Synthetic — 25 taxa, 500 loci' },
  { file: 'synthetic_25taxa_5000loci.nwk', label: 'Synthetic — 25 taxa, 5000 loci' },
  { file: 'synthetic_50taxa_500loci.nwk', label: 'Synthetic — 50 taxa, 500 loci' },
  { file: 'synthetic_50taxa_5000loci.nwk', label: 'Synthetic — 50 taxa, 5000 loci' },
];

export function Dropzone({ hasDataset, dispatch }: { hasDataset: boolean; dispatch: Dispatch<Action> }) {
  const [dragging, setDragging] = useState(false);
  const [sampleChoice, setSampleChoice] = useState(SAMPLE_DATASETS[0].file);
  const [sampleLoading, setSampleLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFromText = useCallback(
    (text: string, name: string) => {
      dispatch({ type: 'LOAD_START' });
      // loadDatasetFromText is synchronous and can block the main thread for
      // 20-30s+ on large datasets - defer it two animation frames so the
      // "loading" state we just dispatched actually gets painted first,
      // rather than the browser freezing before ever showing it.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const dataset = loadDatasetFromText(text, name);
            dispatch({ type: 'LOAD_DATASET', dataset });
          } catch (e) {
            dispatch({ type: 'LOAD_ERROR', message: (e as Error).message });
          }
        });
      });
    },
    [dispatch],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      loadFromText(text, file.name);
    },
    [loadFromText],
  );

  const handleLoadSample = useCallback(async () => {
    setSampleLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample-data/${sampleChoice}`);
      if (!res.ok) throw new Error(`Could not fetch sample dataset (${res.status})`);
      const text = await res.text();
      loadFromText(text, sampleChoice);
    } catch (e) {
      dispatch({ type: 'LOAD_ERROR', message: (e as Error).message });
    } finally {
      setSampleLoading(false);
    }
  }, [sampleChoice, loadFromText, dispatch]);

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

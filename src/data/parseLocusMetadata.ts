import type { LocusMetadataColumn, LocusMetadataTable } from '../types';

/**
 * Parses a user-supplied per-locus metadata table (TSV by default, CSV also
 * accepted). The first column is always the locus-name join key, whatever
 * its header is called - matching is by name, not row position, so the
 * metadata file can list loci in any order and cover any subset of them. It
 * must match a locus name already in the loaded dataset - for a plain
 * multi-tree Newick input that name is "locus_N" (1-based, in file order,
 * since Newick has nowhere to embed a per-tree name); for a NEXUS input with
 * `tree <name> = (...)` statements, it's that name instead. Every other
 * column becomes a named metadata field, auto-typed numeric or categorical
 * by whether every non-empty cell parses as a finite number.
 */
export function parseLocusMetadataTable(text: string, knownLoci: Set<string>): { table: LocusMetadataTable; warnings: string[] } {
  const lines = text
    .split(/\r\n?|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('Metadata file must have a header row (locus-name column + at least one metadata column) plus at least one data row.');
  }

  // Tab-separated is the default/preferred format - safer for fields that may
  // themselves contain commas (e.g. GO term descriptions) - and is detected
  // from the header line alone, not the whole file, so a comma-separated
  // value elsewhere can't cause a wrong delimiter guess.
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(delimiter).map((h) => h.trim());
  if (header.length < 2) {
    throw new Error('Metadata file must have at least two columns: a locus-name column, then one or more metadata columns.');
  }
  const columnNames = header.slice(1);

  const rows = lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    return { locus: cells[0], cells: cells.slice(1) };
  });

  const columns: LocusMetadataColumn[] = columnNames.map((name, i) => {
    const isNumeric = rows.every((row) => {
      const cell = row.cells[i];
      return cell === undefined || cell === '' || Number.isFinite(Number(cell));
    });
    return { name, kind: isNumeric ? 'numeric' : 'categorical' };
  });

  const values = new Map<string, Record<string, number | string>>();
  const warnings: string[] = [];
  let matched = 0;
  const unmatchedRows: string[] = [];

  for (const row of rows) {
    if (!knownLoci.has(row.locus)) {
      unmatchedRows.push(row.locus);
      continue;
    }
    matched++;
    const record: Record<string, number | string> = {};
    columns.forEach((col, i) => {
      const cell = row.cells[i];
      if (cell === undefined || cell === '') return;
      record[col.name] = col.kind === 'numeric' ? Number(cell) : cell;
    });
    values.set(row.locus, record);
  }

  if (matched === 0) {
    throw new Error(
      'None of the metadata rows matched a locus name in this dataset - check that the first column matches your gene tree names exactly (e.g. "locus_1").',
    );
  }
  if (unmatchedRows.length > 0) {
    warnings.push(
      `${unmatchedRows.length} metadata row(s) didn't match any locus in this dataset and were skipped (${unmatchedRows.slice(0, 5).join(', ')}${unmatchedRows.length > 5 ? ', …' : ''}).`,
    );
  }
  const uncovered = knownLoci.size - matched;
  if (uncovered > 0) {
    warnings.push(`${uncovered} of ${knownLoci.size} loci have no matching metadata row and will show as "no data" in the metadata track.`);
  }

  return { table: { columns, values }, warnings };
}

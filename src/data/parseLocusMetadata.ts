import type { LocusMetadataColumn, LocusMetadataTable } from '../types';

/**
 * Parses a user-supplied per-locus metadata table (CSV or TSV). The first
 * column is always the locus-name join key, whatever its header is called -
 * it must match a locus name already in the loaded dataset (e.g. "locus_1").
 * Every other column becomes a named metadata field, auto-typed numeric or
 * categorical by whether every non-empty cell parses as a finite number.
 */
export function parseLocusMetadataTable(text: string, knownLoci: Set<string>): { table: LocusMetadataTable; warnings: string[] } {
  const delimiter = text.includes('\t') ? '\t' : ',';
  const lines = text
    .split(/\r\n?|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('Metadata file must have a header row (locus-name column + at least one metadata column) plus at least one data row.');
  }

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

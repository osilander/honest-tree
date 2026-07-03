/** Newick converts underscores to spaces on parse, but users will naturally
 * type taxon names the way they appear in the source file (with underscores)
 * - normalize both sides so "Taxon_19" and "Taxon 19" match identically. */
export function normalizeTaxonQuery(s: string): string {
  return s.trim().toLowerCase().replace(/_/g, ' ');
}

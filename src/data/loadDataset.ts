import { parseTreeFile, getLeafNames } from '../parsing/newick';
import { buildTaxonIndex, taxonCoverageWarnings } from '../phylo/splits';
import { buildGreedyConsensus } from '../phylo/consensus';
import { tallyCladeFrequencies } from '../phylo/splits';
import { computeBranchRecords } from '../phylo/concordance';
import { assignAverageBranchLengths } from '../phylo/branchLengths';
import { computeTopologyRanking } from '../phylo/topologyRanking';
import type { Dataset, RawNode } from '../types';

/**
 * Validates that a user-supplied reference tree's taxon set exactly equals
 * the union of taxa across all gene trees - not each individual gene tree,
 * which is allowed to have its own missing taxa. Every downstream computation
 * assumes the reference tree spans this full taxon universe (e.g.
 * buildGreedyConsensus guarantees this by construction) - an externally-
 * supplied tree has no such guarantee, so it's checked explicitly with a
 * specific, actionable error rather than failing later with an opaque
 * "taxon not in index" exception.
 */
function validateReferenceTaxa(referenceRoot: RawNode, geneTreeTaxonUniverse: string[]): void {
  const refTaxa = new Set(getLeafNames(referenceRoot));
  const geneTaxa = new Set(geneTreeTaxonUniverse);

  const missingFromRef = geneTreeTaxonUniverse.filter((t) => !refTaxa.has(t));
  const extraInRef = [...refTaxa].filter((t) => !geneTaxa.has(t));

  if (missingFromRef.length > 0 || extraInRef.length > 0) {
    const parts: string[] = [];
    if (missingFromRef.length > 0) {
      parts.push(`is missing ${missingFromRef.length} taxon/taxa that appear in at least one gene tree (${missingFromRef.slice(0, 6).join(', ')}${missingFromRef.length > 6 ? ', …' : ''})`);
    }
    if (extraInRef.length > 0) {
      parts.push(`has ${extraInRef.length} taxon/taxa that appear in no gene tree (${extraInRef.slice(0, 6).join(', ')}${extraInRef.length > 6 ? ', …' : ''})`);
    }
    throw new Error(
      `Reference tree taxon set doesn't match your gene trees: it ${parts.join('; it ')}. The reference tree must contain every taxon that appears in any of your gene trees, and no others (individual gene trees may still be missing taxa).`,
    );
  }
}

export function loadDatasetFromText(
  text: string,
  sourceName: string,
  referenceTreeText?: string,
  referenceTreeFileName?: string,
): Dataset {
  const { trees, errors } = parseTreeFile(text);
  if (trees.length === 0) {
    throw new Error(`No trees could be parsed from "${sourceName}".${errors.length ? ' ' + errors.join(' ') : ''}`);
  }

  const index = buildTaxonIndex(trees);
  const warnings = [...errors, ...taxonCoverageWarnings(trees, index)];

  let referenceTree: RawNode;
  let referenceTreeSource: 'consensus' | 'user';
  if (referenceTreeText) {
    const { trees: refTrees, errors: refErrors } = parseTreeFile(referenceTreeText);
    if (refTrees.length === 0) {
      throw new Error(`No tree could be parsed from the supplied reference tree file.${refErrors.length ? ' ' + refErrors.join(' ') : ''}`);
    }
    referenceTree = refTrees[0].root;
    validateReferenceTaxa(referenceTree, index.taxa);
    referenceTreeSource = 'user';
  } else {
    const cladeFrequencies = tallyCladeFrequencies(trees, index);
    referenceTree = buildGreedyConsensus(index, cladeFrequencies);
    referenceTreeSource = 'consensus';
  }

  const lengthObservations = assignAverageBranchLengths(referenceTree, trees, index);
  const branches = computeBranchRecords(referenceTree, trees, index);
  for (const [splitId, observations] of lengthObservations) {
    const record = branches.get(splitId);
    if (record) record.lengthObservations = observations;
  }
  const topologyRanking = computeTopologyRanking(trees);

  return {
    taxa: index.taxa,
    geneTrees: trees,
    referenceTree,
    referenceTreeSource,
    referenceTreeFileName: referenceTreeSource === 'user' ? referenceTreeFileName : undefined,
    branches,
    locusMetadata: new Map(),
    warnings,
    taxonIndex: index,
    topologyRanking,
  };
}

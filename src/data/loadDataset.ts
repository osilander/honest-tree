import { parseTreeFile, getLeafNames } from '../parsing/newick';
import { buildTaxonIndex, taxonCoverageWarnings } from '../phylo/splits';
import { buildGreedyConsensus } from '../phylo/consensus';
import { tallyCladeFrequencies } from '../phylo/splits';
import { computeBranchRecords } from '../phylo/concordance';
import { assignAverageBranchLengths } from '../phylo/branchLengths';
import { computeTopologyRanking } from '../phylo/topologyRanking';
import type { Dataset, RawNode } from '../types';

/**
 * Validates that a user-supplied reference tree covers exactly the same taxon
 * set as the gene trees. Every downstream computation assumes the reference
 * tree spans the full taxon universe (e.g. buildGreedyConsensus guarantees
 * this by construction) - an externally-supplied tree has no such guarantee,
 * so it's checked explicitly with a specific, actionable error rather than
 * failing later with an opaque "taxon not in index" exception.
 */
function validateReferenceTaxa(referenceRoot: RawNode, geneTreeTaxa: string[]): void {
  const refTaxa = new Set(getLeafNames(referenceRoot));
  const geneTaxa = new Set(geneTreeTaxa);

  const missingFromRef = geneTreeTaxa.filter((t) => !refTaxa.has(t));
  const extraInRef = [...refTaxa].filter((t) => !geneTaxa.has(t));

  if (missingFromRef.length > 0 || extraInRef.length > 0) {
    const parts: string[] = [];
    if (missingFromRef.length > 0) {
      parts.push(`missing ${missingFromRef.length} taxon/taxa present in the gene trees (${missingFromRef.slice(0, 6).join(', ')}${missingFromRef.length > 6 ? ', …' : ''})`);
    }
    if (extraInRef.length > 0) {
      parts.push(`has ${extraInRef.length} taxon/taxa not present in any gene tree (${extraInRef.slice(0, 6).join(', ')}${extraInRef.length > 6 ? ', …' : ''})`);
    }
    throw new Error(`Reference tree taxon set doesn't match the gene trees: it ${parts.join('; it ')}. Both must contain exactly the same taxa.`);
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

import { parseTreeFile } from '../parsing/newick';
import { buildTaxonIndex, taxonCoverageWarnings } from '../phylo/splits';
import { buildGreedyConsensus } from '../phylo/consensus';
import { tallyCladeFrequencies } from '../phylo/splits';
import { computeBranchRecords } from '../phylo/concordance';
import { assignAverageBranchLengths } from '../phylo/branchLengths';
import { computeTopologyRanking } from '../phylo/topologyRanking';
import type { Dataset } from '../types';

export function loadDatasetFromText(text: string, sourceName: string): Dataset {
  const { trees, errors } = parseTreeFile(text);
  if (trees.length === 0) {
    throw new Error(`No trees could be parsed from "${sourceName}".${errors.length ? ' ' + errors.join(' ') : ''}`);
  }

  const index = buildTaxonIndex(trees);
  const warnings = [...errors, ...taxonCoverageWarnings(trees, index)];

  const cladeFrequencies = tallyCladeFrequencies(trees, index);
  const referenceTree = buildGreedyConsensus(index, cladeFrequencies);
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
    branches,
    locusMetadata: new Map(),
    warnings,
    taxonIndex: index,
    topologyRanking,
  };
}

import type { ParsedTree, RawNode } from '../types';

/** Parses a single Newick statement (terminated by ';') into a RawNode tree. */
export function parseNewick(input: string): RawNode {
  let str = input.trim();
  if (!str.endsWith(';')) str += ';';
  let i = 0;

  function error(msg: string): never {
    throw new Error(`Newick parse error at char ${i}: ${msg}\n...${str.slice(Math.max(0, i - 20), i + 20)}...`);
  }

  function skipComments() {
    while (str[i] === '[') {
      const end = str.indexOf(']', i);
      if (end === -1) error('unterminated comment');
      i = end + 1;
    }
  }

  function readLabel(): string {
    skipComments();
    if (str[i] === "'") {
      let out = '';
      i++;
      while (i < str.length) {
        if (str[i] === "'" && str[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        if (str[i] === "'") {
          i++;
          break;
        }
        out += str[i];
        i++;
      }
      return out;
    }
    const start = i;
    while (i < str.length && !",():;[".includes(str[i])) i++;
    const raw = str.slice(start, i);
    skipComments();
    return raw.replace(/_/g, ' ').trim();
  }

  function readNode(): RawNode {
    skipComments();
    const node: RawNode = { name: '', length: null, children: [] };
    if (str[i] === '(') {
      i++;
      while (true) {
        node.children.push(readNode());
        skipComments();
        if (str[i] === ',') {
          i++;
          continue;
        }
        if (str[i] === ')') {
          i++;
          break;
        }
        error("expected ',' or ')'");
      }
      skipComments();
      const label = readLabel();
      if (label && /^-?\d+(\.\d+)?$/.test(label)) {
        node.supportLabel = parseFloat(label);
      } else {
        node.name = label;
      }
    } else {
      node.name = readLabel();
    }
    skipComments();
    if (str[i] === ':') {
      i++;
      skipComments();
      const start = i;
      while (i < str.length && !",():;[".includes(str[i])) i++;
      node.length = parseFloat(str.slice(start, i));
      skipComments();
    }
    return node;
  }

  const root = readNode();
  skipComments();
  if (str[i] !== ';') error("expected ';' at end of tree");
  return root;
}

/** Splits a blob of text into individual ';'-terminated statements, respecting quotes/comments. */
function splitStatements(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  let commentDepth = 0;
  for (let idx = 0; idx < text.length; idx++) {
    const c = text[idx];
    if (c === "'") {
      inQuote = !inQuote;
      cur += c;
      continue;
    }
    if (!inQuote && c === '[') {
      commentDepth++;
      cur += c;
      continue;
    }
    if (!inQuote && c === ']') {
      commentDepth--;
      cur += c;
      continue;
    }
    if (!inQuote && commentDepth === 0 && c === ';') {
      cur += ';';
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim().length) out.push(cur);
  return out;
}

function applyTranslation(node: RawNode, translate: Record<string, string>) {
  if (node.children.length === 0 && node.name && translate[node.name] !== undefined) {
    node.name = translate[node.name];
  }
  for (const c of node.children) applyTranslation(c, translate);
}

function parseNexus(text: string, trees: ParsedTree[], errors: string[]) {
  const translate: Record<string, string> = {};
  const transMatch = text.match(/translate([\s\S]*?);/i);
  if (transMatch) {
    const parts = transMatch[1].split(',');
    for (const p of parts) {
      const m = p.trim().match(/^(\S+)\s+(.+)$/s);
      if (m) {
        let label = m[2].trim();
        label = label.replace(/^'([\s\S]*)'$/, '$1').replace(/''/g, "'");
        translate[m[1]] = label.replace(/_/g, ' ');
      }
    }
  }

  const treeBlockMatch = text.match(/begin trees;([\s\S]*?)end;/i);
  const scope = treeBlockMatch ? treeBlockMatch[1] : text;
  const stmts = splitStatements(scope);
  let idx = 0;
  for (const stmt of stmts) {
    const m = stmt.match(/tree\s+([^\s=]+)\s*=\s*(\[[^\]]*\]\s*)?([\s\S]+;)/i);
    if (!m) continue;
    idx++;
    const name = m[1];
    const newickStr = m[3];
    try {
      const root = parseNewick(newickStr);
      if (Object.keys(translate).length) applyTranslation(root, translate);
      trees.push({ name, root });
    } catch (e) {
      errors.push(`Tree ${name}: ${(e as Error).message}`);
    }
  }
}

export interface ParseResult {
  trees: ParsedTree[];
  errors: string[];
}

/** Top-level entry point: handles plain multi-tree Newick files and light NEXUS trees blocks. */
export function parseTreeFile(text: string): ParseResult {
  const normalized = text.replace(/\r\n?/g, '\n');
  const trees: ParsedTree[] = [];
  const errors: string[] = [];

  if (/^\s*#NEXUS/i.test(normalized)) {
    parseNexus(normalized, trees, errors);
  } else {
    const statements = splitStatements(normalized);
    let idx = 0;
    for (const stmt of statements) {
      const s = stmt.trim();
      if (!s || s === ';') continue;
      idx++;
      try {
        trees.push({ name: `locus_${idx}`, root: parseNewick(s) });
      } catch (e) {
        errors.push(`Tree ${idx}: ${(e as Error).message}`);
      }
    }
  }
  return { trees, errors };
}

export function getLeafNames(root: RawNode): string[] {
  const out: string[] = [];
  (function walk(n: RawNode) {
    if (n.children.length === 0) out.push(n.name);
    else n.children.forEach(walk);
  })(root);
  return out;
}

export function cloneTree(node: RawNode): RawNode {
  return {
    name: node.name,
    length: node.length,
    supportLabel: node.supportLabel,
    children: node.children.map(cloneTree),
  };
}

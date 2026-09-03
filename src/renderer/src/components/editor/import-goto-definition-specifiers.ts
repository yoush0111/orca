import type { IRange } from 'monaco-editor'

export type ImportSpecifierMatch = { range: IRange; specifier: string }

// import x from '...'; export x from '...'
// import('...'); require('...')
// import '...' (side-effect import, no `from`)
const IMPORT_SPECIFIER_LINE_PATTERNS: RegExp[] = [
  /\bfrom\s+(['"])((?:(?!\1).)+)\1/g,
  /\b(?:import|require)\s*\(\s*(['"])((?:(?!\1).)+)\1\s*\)/g,
  /^\s*import\s+(['"])((?:(?!\1).)+)\1\s*;?\s*$/g
]

// Only relative and `@/*` alias specifiers are resolvable to a workspace file.
function isResolvableSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('@/')
}

export type ImportSymbolMatch = {
  range: IRange
  specifier: string
  /** Name as exported by the target module; 'default' for a default import. */
  symbol: string
  /** Name this import binds locally — what the file body actually references. */
  localName: string
}

// Import clauses can span lines, so this matches whole statements rather than lines.
// The clause charset stays narrow ({}, *, identifiers, commas) so a stray `import`
// inside a string can't swallow arbitrary text up to the next `from`.
const IMPORT_CLAUSE_PATTERN =
  /\b(?:import|export)\s+([\w$*,{}\s]+?)\s+from\s+(['"])((?:(?!\2).)+)\2/g
const CLAUSE_IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/g

function offsetToPosition(content: string, offset: number): { line: number; column: number } {
  let line = 1
  let lineStart = 0
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1
      lineStart = index + 1
    }
  }
  return { line, column: offset - lineStart + 1 }
}

export function findImportSymbolRanges(content: string): ImportSymbolMatch[] {
  const matches: ImportSymbolMatch[] = []
  IMPORT_CLAUSE_PATTERN.lastIndex = 0
  let statement: RegExpExecArray | null
  while ((statement = IMPORT_CLAUSE_PATTERN.exec(content)) !== null) {
    const clause = statement[1]
    const specifier = statement[3]
    if (!isResolvableSpecifier(specifier)) {
      continue
    }
    const clauseOffset = statement.index + statement[0].indexOf(clause)
    CLAUSE_IDENTIFIER_PATTERN.lastIndex = 0
    let renamedMatch: ImportSymbolMatch | null = null
    let skipNamespaceAlias = false
    let identifier: RegExpExecArray | null
    while ((identifier = CLAUSE_IDENTIFIER_PATTERN.exec(clause)) !== null) {
      const name = identifier[0]
      if (name === 'type') {
        continue
      }
      if (name === 'as') {
        // A namespace import (`* as ns`) binds no single export, so it stays
        // unlinked — the path link already covers opening that file.
        if (clause.slice(0, identifier.index).trimEnd().endsWith('*')) {
          skipNamespaceAlias = true
        } else {
          renamedMatch = matches.at(-1) ?? null
        }
        continue
      }
      if (skipNamespaceAlias) {
        skipNamespaceAlias = false
        continue
      }
      if (renamedMatch) {
        // Why: `foo as bar` — the body references `bar`, but only `foo` exists
        // in the target module.
        renamedMatch.localName = name
        renamedMatch = null
        continue
      }
      const insideBraces =
        clause.lastIndexOf('{', identifier.index) > clause.lastIndexOf('}', identifier.index)
      const start = offsetToPosition(content, clauseOffset + identifier.index)
      matches.push({
        range: {
          startLineNumber: start.line,
          startColumn: start.column,
          endLineNumber: start.line,
          endColumn: start.column + name.length
        },
        specifier,
        symbol: insideBraces ? name : 'default',
        localName: name
      })
    }
  }
  return matches
}

export function findImportSpecifierRanges(content: string): ImportSpecifierMatch[] {
  const matches: ImportSpecifierMatch[] = []
  const lines = content.split('\n')
  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1
    const claimedColumns = new Set<number>()
    for (const pattern of IMPORT_SPECIFIER_LINE_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        const quote = match[1]
        const specifier = match[2]
        const quoted = `${quote}${specifier}${quote}`
        const specifierStart = match.index + match[0].indexOf(quoted) + 1
        if (!isResolvableSpecifier(specifier) || claimedColumns.has(specifierStart)) {
          continue
        }
        claimedColumns.add(specifierStart)
        matches.push({
          range: {
            startLineNumber: lineNumber,
            startColumn: specifierStart + 1,
            endLineNumber: lineNumber,
            endColumn: specifierStart + 1 + specifier.length
          },
          specifier
        })
      }
    }
  })
  return matches
}

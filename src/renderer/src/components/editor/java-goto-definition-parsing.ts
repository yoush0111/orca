import { escapeForRegExp } from './import-goto-definition-symbol-lookup'

export type JavaClick =
  | { kind: 'import'; classFqn: string; member: string | null }
  | { kind: 'type'; name: string }
  | { kind: 'method'; name: string; receiver: string | null }

export type JavaImport = { path: string; isStatic: boolean; isWildcard: boolean }

const IMPORT_PATTERN = /^[^\S\n]*import\s+(static\s+)?([\w$.]+?)(\.\*)?\s*;/
const MEMBER_MODIFIERS =
  'public|protected|private|static|final|abstract|synchronized|native|default|strictfp'
const TYPE_MODIFIERS = 'public|protected|private|static|final|abstract|sealed|non-sealed|strictfp'
// Statement keywords that can sit where a return type would, e.g. `return foo(`.
const NON_TYPE_KEYWORDS = 'return|new|throw|else|case|yield|assert'
const ANNOTATIONS = '(?:@[\\w$.]+(?:\\([^)\\n]*\\))?[^\\S\\n]+)*'
const GENERIC_ARGS = '(?:\\s*<[^;(){}=\\n]*>)?'

function lineOfOffset(content: string, offset: number): number {
  return content.slice(0, offset).split('\n').length
}

export function parseJavaPackage(content: string): string | null {
  return /^[^\S\n]*package\s+([\w$.]+)\s*;/m.exec(content)?.[1] ?? null
}

export function parseJavaImports(content: string): JavaImport[] {
  return content.split('\n').flatMap((line) => {
    const match = IMPORT_PATTERN.exec(line)
    return match ? [{ path: match[2], isStatic: !!match[1], isWildcard: !!match[3] }] : []
  })
}

/** What a ctrl+click on the word at [wordStart, wordEnd) of `lineText` asks for. */
export function classifyJavaClick(
  lineText: string,
  wordStart: number,
  wordEnd: number
): JavaClick | null {
  const importMatch = IMPORT_PATTERN.exec(lineText)
  if (importMatch) {
    return classifyImport({
      path: importMatch[2],
      isStatic: !!importMatch[1],
      isWildcard: !!importMatch[3]
    })
  }
  const word = lineText.slice(wordStart, wordEnd)
  const before = lineText.slice(0, wordStart)
  if (/\bnew\s+$/.test(before)) {
    return { kind: 'type', name: word }
  }
  if (/^\s*\(/.test(lineText.slice(wordEnd))) {
    return classifyMethodCall(word, before)
  }
  return /^[A-Z]/.test(word) ? { kind: 'type', name: word } : null
}

function classifyImport({ path, isStatic, isWildcard }: JavaImport): JavaClick | null {
  if (isWildcard) {
    return null
  }
  if (!isStatic) {
    return { kind: 'import', classFqn: path, member: null }
  }
  const dot = path.lastIndexOf('.')
  return dot === -1
    ? null
    : { kind: 'import', classFqn: path.slice(0, dot), member: path.slice(dot + 1) }
}

function classifyMethodCall(name: string, before: string): JavaClick | null {
  if (!/\.\s*$/.test(before)) {
    return { kind: 'method', name, receiver: null }
  }
  // ponytail: single-identifier receivers only; chains (`a().b()`, `a.b.c()`) and
  // `super.` (inheritance) return null.
  const receiver = /(?:^|[^\w$.\s])\s*([\w$]+)\s*\.\s*$/.exec(before)?.[1]
  if (!receiver || receiver === 'super') {
    return null
  }
  return { kind: 'method', name, receiver: receiver === 'this' ? null : receiver }
}

/** Line (1-based) of the `class|interface|enum|record name` declaration, or null. */
export function findJavaTypeDeclarationLine(content: string, name: string): number | null {
  const pattern = new RegExp(
    `^[^\\S\\n]*${ANNOTATIONS}(?:(?:${TYPE_MODIFIERS})\\s+)*(?:class|interface|enum|record|@interface)\\s+${escapeForRegExp(name)}\\b`,
    'm'
  )
  const match = pattern.exec(content)
  return match ? lineOfOffset(content, match.index) : null
}

/**
 * Line (1-based) of the first method declaration named `name`, or null.
 *
 * ponytail: first match wins — overloads and same-named methods in nested types
 * are not told apart; a real Java parser/LSP is the upgrade path.
 */
export function findJavaMethodDeclarationLine(content: string, name: string): number | null {
  const pattern = new RegExp(
    `^[^\\S\\n]*${ANNOTATIONS}(?:(?:${MEMBER_MODIFIERS})\\s+)*(?:<[^;(){}=\\n]*>\\s*)?` +
      `(?!(?:${NON_TYPE_KEYWORDS})\\b)[\\w$.]+${GENERIC_ARGS}(?:\\s*\\[\\s*\\])*\\s+${escapeForRegExp(name)}\\s*\\(`,
    'm'
  )
  const match = pattern.exec(content)
  return match ? lineOfOffset(content, match.index) : null
}

/**
 * Declared type of variable/field/parameter `name`: the nearest declaration
 * before `offset` (locals shadow fields), else the first one after it.
 *
 * ponytail: simple, capitalized type names only — `var`, primitives, arrays and
 * qualified types (`a.b.Foo x`) return null.
 */
export function inferJavaVariableType(
  content: string,
  name: string,
  offset: number
): string | null {
  const pattern = new RegExp(
    `(?<![\\w$.])([A-Z][\\w$]*)${GENERIC_ARGS}\\s+${escapeForRegExp(name)}\\s*[=;,):]`,
    'g'
  )
  let before: string | null = null
  for (const match of content.matchAll(pattern)) {
    if (match.index >= offset) {
      return before ?? match[1]
    }
    before = match[1]
  }
  return before
}

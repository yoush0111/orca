const DECLARATION_KEYWORDS = 'function|const|let|var|class|type|interface|enum'

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Line (1-based) where `symbolName` is declared/exported in `content`, or null.
 *
 * Regex-based on purpose: the TS language service is disabled in this editor
 * (see monaco-setup.ts), so this is a best-effort jump — a miss just opens the
 * file at the top.
 */
export function findExportedSymbolLine(content: string, symbolName: string): number | null {
  const patterns =
    symbolName === 'default'
      ? [/^[^\S\n]*export\s+default\b/m]
      : buildNamedSymbolPatterns(escapeForRegExp(symbolName))

  for (const pattern of patterns) {
    const match = pattern.exec(content)
    if (match) {
      return content.slice(0, match.index).split('\n').length
    }
  }
  return null
}

/**
 * Line (1-based) where `name` is declared in this same file, or null.
 *
 * Covers top-level-style declarations only; parameters, destructured bindings,
 * and object members are out of reach for a regex and simply don't navigate.
 */
export function findLocalDeclarationLine(content: string, name: string): number | null {
  const escaped = escapeForRegExp(name)
  const patterns = [
    new RegExp(
      `^[^\\S\\n]*(?:export\\s+)?(?:declare\\s+)?(?:async\\s+)?(?:${DECLARATION_KEYWORDS})\\s+${escaped}\\b`,
      'm'
    ),
    // Arrow/function assigned to an already-declared name, or a class member.
    new RegExp(`^[^\\S\\n]*${escaped}\\s*[:=]\\s*(?:async\\s*)?(?:\\(|function\\b|<)`, 'm')
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(content)
    if (match) {
      return content.slice(0, match.index).split('\n').length
    }
  }
  return null
}

function buildNamedSymbolPatterns(name: string): RegExp[] {
  return [
    // export const foo / export async function foo / export declare class foo
    new RegExp(
      `^[^\\S\\n]*export\\s+(?:declare\\s+)?(?:async\\s+)?(?:${DECLARATION_KEYWORDS})\\s+${name}\\b`,
      'm'
    ),
    // export { foo } / export { foo as bar }
    new RegExp(`^[^\\S\\n]*export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`, 'm'),
    // Declared first, exported further down.
    new RegExp(
      `^[^\\S\\n]*(?:declare\\s+)?(?:async\\s+)?(?:${DECLARATION_KEYWORDS})\\s+${name}\\b`,
      'm'
    )
  ]
}

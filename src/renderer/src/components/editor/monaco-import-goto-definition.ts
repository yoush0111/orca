import type { editor, IDisposable, IRange, languages, Position } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { useAppStore } from '@/store'
import { detectLanguage } from '@/lib/language-detect'
import {
  findImportSpecifierRanges,
  findImportSymbolRanges,
  type ImportSymbolMatch
} from './import-goto-definition-specifiers'
import { resolveImportSpecifierTarget } from './import-goto-definition-resolution'
import {
  findExportedSymbolLine,
  findLocalDeclarationLine
} from './import-goto-definition-symbol-lookup'
import { deriveMarkdownPreviewSourceRoot } from './markdown-preview-source-routing'

const IMPORT_GOTO_DEFINITION_SCHEME = 'orca-import-goto'

function buildImportTargetUri(params: {
  absolutePath: string
  relativePath: string
  worktreeId: string
  symbol?: string
  line?: number
}): monaco.Uri {
  const query = new URLSearchParams({
    worktreeId: params.worktreeId,
    relativePath: params.relativePath,
    ...(params.symbol ? { symbol: params.symbol } : {}),
    ...(params.line ? { line: String(params.line) } : {})
  }).toString()
  return monaco.Uri.from({
    scheme: IMPORT_GOTO_DEFINITION_SCHEME,
    path: params.absolutePath,
    query
  })
}

/** Opens a target Uri built by `buildImportTargetUri` as an editor tab. */
function openImportTarget(resource: monaco.Uri): boolean {
  if (resource.scheme !== IMPORT_GOTO_DEFINITION_SCHEME) {
    return false
  }
  const params = new URLSearchParams(resource.query)
  const worktreeId = params.get('worktreeId')
  if (!worktreeId) {
    return false
  }
  const filePath = resource.path
  const store = useAppStore.getState()
  store.openFile(
    {
      filePath,
      relativePath: params.get('relativePath') ?? filePath,
      worktreeId,
      language: detectLanguage(filePath),
      mode: 'edit'
    },
    // Why: a definition jump is a deliberate navigation, so it earns its own tab
    // instead of recycling the shared preview slot.
    { preview: false, focusEditor: true }
  )

  const knownLine = Number(params.get('line'))
  if (Number.isFinite(knownLine) && knownLine > 0) {
    revealLine(filePath, knownLine)
    return true
  }
  const symbol = params.get('symbol')
  if (symbol) {
    void revealSymbolDefinition(filePath, symbol)
  }
  return true
}

// Why: registered once globally — a target Uri carries every field (absolute
// path, relativePath, worktreeId, symbol/line) the opener needs, so neither
// opener needs per-editor context.
export function installMonacoImportGotoDefinitionOpener(): IDisposable {
  const linkOpener = monaco.editor.registerLinkOpener({
    open: (resource) => openImportTarget(resource)
  })
  // Why: "go to definition" resolving to another file routes through the editor
  // opener, not the link opener.
  const editorOpener = monaco.editor.registerEditorOpener({
    openCodeEditor: (_source, resource) => openImportTarget(resource)
  })
  return {
    dispose: () => {
      linkOpener.dispose()
      editorOpener.dispose()
    }
  }
}

async function revealSymbolDefinition(filePath: string, symbol: string): Promise<void> {
  const line = await findSymbolLineInFile(filePath, symbol)
  if (line !== null) {
    revealLine(filePath, line)
  }
}

async function findSymbolLineInFile(filePath: string, symbol: string): Promise<number | null> {
  try {
    const file = await window.api.fs.readFile({ filePath })
    return file.isBinary ? null : findExportedSymbolLine(file.content, symbol)
  } catch {
    // Why: an unreadable target still opened fine — just skip the line jump.
    return null
  }
}

function revealLine(filePath: string, line: number): void {
  const store = useAppStore.getState()
  store.setPendingEditorReveal(null)
  // Why: opening mounts Monaco asynchronously. Matching search and terminal-link
  // navigation, wait two frames so the destination editor owns layout first.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      store.setPendingEditorReveal({ filePath, line, column: 1, matchLength: 0 })
    })
  })
}

export type ImportGotoDefinitionContext = {
  filePath: string
  relativePath: string
  worktreeId: string | undefined
}

type ImportLinkCandidate = { range: IRange; specifier: string; symbol?: string }

type ResolvedContext = {
  filePath: string
  worktreeId: string
  worktreeRoot: string | null
}

function readContext(getContext: () => ImportGotoDefinitionContext): ResolvedContext | null {
  const { filePath, relativePath, worktreeId } = getContext()
  if (!worktreeId) {
    return null
  }
  return {
    filePath,
    worktreeId,
    worktreeRoot: deriveMarkdownPreviewSourceRoot(filePath, relativePath)
  }
}

function resolveTarget(
  context: ResolvedContext,
  specifier: string
): ReturnType<typeof resolveImportSpecifierTarget> {
  return resolveImportSpecifierTarget(specifier, context.filePath, context.worktreeRoot, (path) =>
    window.api.shell.pathExists(path)
  )
}

// Why: Monaco's provider registries are global per language, so every editor
// registers its own instances and filters to its own model — mirrors the
// per-editor scoping already used by markdown doc link decorations.
export function createImportGotoDefinitionLinkProvider(
  editorInstance: editor.IStandaloneCodeEditor,
  getContext: () => ImportGotoDefinitionContext
): IDisposable {
  return monaco.languages.registerLinkProvider(['typescript', 'javascript'], {
    async provideLinks(model) {
      if (model !== editorInstance.getModel()) {
        return { links: [] }
      }
      const context = readContext(getContext)
      if (!context) {
        return { links: [] }
      }
      const content = model.getValue()
      const candidates: ImportLinkCandidate[] = [
        ...findImportSpecifierRanges(content),
        ...findImportSymbolRanges(content)
      ]
      const links = await Promise.all(
        candidates.map(async ({ range, specifier, symbol }) => {
          const target = await resolveTarget(context, specifier)
          if (!target) {
            return null
          }
          return {
            range,
            tooltip: symbol ? 'Go to definition' : 'Open file',
            url: buildImportTargetUri({
              absolutePath: target.absolutePath,
              relativePath: target.relativePath,
              worktreeId: context.worktreeId,
              symbol
            })
          }
        })
      )
      return { links: links.filter((link): link is NonNullable<typeof link> => link !== null) }
    }
  })
}

/**
 * Go-to-definition for identifiers in the file body.
 *
 * Replaces Monaco's bundled TS provider (disabled in monaco-setup.ts), which
 * could only resolve an imported name to its own import statement because the
 * sandboxed worker never sees the target module.
 */
export function createImportGotoDefinitionDefinitionProvider(
  editorInstance: editor.IStandaloneCodeEditor,
  getContext: () => ImportGotoDefinitionContext
): IDisposable {
  return monaco.languages.registerDefinitionProvider(['typescript', 'javascript'], {
    async provideDefinition(model, position) {
      if (model !== editorInstance.getModel()) {
        return null
      }
      const word = model.getWordAtPosition(position)
      if (!word) {
        return null
      }
      const content = model.getValue()
      const importMatches = findImportSymbolRanges(content)
      // Inside the import statement itself the link provider already owns the
      // click; answering here too would race it into a duplicate open.
      if (isInsideRanges(position, importMatches)) {
        return null
      }

      const imported = importMatches.find((match) => match.localName === word.word)
      if (imported) {
        return resolveImportedDefinition(getContext, imported)
      }

      const line = findLocalDeclarationLine(content, word.word)
      return line === null
        ? null
        : { uri: model.uri, range: wholeLineRange(line, model.getLineMaxColumn(line)) }
    }
  })
}

async function resolveImportedDefinition(
  getContext: () => ImportGotoDefinitionContext,
  imported: ImportSymbolMatch
): Promise<languages.Definition | null> {
  const context = readContext(getContext)
  if (!context) {
    return null
  }
  const target = await resolveTarget(context, imported.specifier)
  if (!target) {
    return null
  }
  const line = await findSymbolLineInFile(target.absolutePath, imported.symbol)
  return {
    uri: buildImportTargetUri({
      absolutePath: target.absolutePath,
      relativePath: target.relativePath,
      worktreeId: context.worktreeId,
      symbol: imported.symbol,
      line: line ?? undefined
    }),
    range: wholeLineRange(line ?? 1, 1)
  }
}

function wholeLineRange(line: number, endColumn: number): IRange {
  return { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn }
}

function isInsideRanges(position: Position, matches: { range: IRange }[]): boolean {
  return matches.some(
    ({ range }) =>
      position.lineNumber === range.startLineNumber &&
      position.column >= range.startColumn &&
      position.column <= range.endColumn
  )
}

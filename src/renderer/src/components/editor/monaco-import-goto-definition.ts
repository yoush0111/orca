import type { editor, IDisposable, IRange } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { useAppStore } from '@/store'
import { detectLanguage } from '@/lib/language-detect'
import {
  findImportSpecifierRanges,
  findImportSymbolRanges
} from './import-goto-definition-specifiers'
import { resolveImportSpecifierTarget } from './import-goto-definition-resolution'
import { findExportedSymbolLine } from './import-goto-definition-symbol-lookup'
import { deriveMarkdownPreviewSourceRoot } from './markdown-preview-source-routing'

const IMPORT_GOTO_DEFINITION_SCHEME = 'orca-import-goto'

// Why: registered once globally — the link's Uri already carries every field
// (absolute path, relativePath, worktreeId, symbol) needed to open the file, so
// the opener needs no per-editor context.
export function installMonacoImportGotoDefinitionOpener(): IDisposable {
  return monaco.editor.registerLinkOpener({
    open(resource) {
      if (resource.scheme !== IMPORT_GOTO_DEFINITION_SCHEME) {
        return false
      }
      const params = new URLSearchParams(resource.query)
      const worktreeId = params.get('worktreeId')
      if (!worktreeId) {
        return false
      }
      const filePath = resource.path
      const relativePath = params.get('relativePath') ?? filePath
      const symbol = params.get('symbol')
      const store = useAppStore.getState()
      store.openFile(
        {
          filePath,
          relativePath,
          worktreeId,
          language: detectLanguage(filePath),
          mode: 'edit'
        },
        { preview: true, focusEditor: true }
      )
      if (symbol) {
        void revealSymbolDefinition(filePath, symbol)
      }
      return true
    }
  })
}

async function revealSymbolDefinition(filePath: string, symbol: string): Promise<void> {
  let line: number | null = null
  try {
    const file = await window.api.fs.readFile({ filePath })
    line = file.isBinary ? null : findExportedSymbolLine(file.content, symbol)
  } catch {
    // Why: an unreadable target still opened fine — just skip the line jump.
    return
  }
  if (line === null) {
    return
  }
  const store = useAppStore.getState()
  store.setPendingEditorReveal(null)
  // Why: opening mounts Monaco asynchronously. Matching search and terminal-link
  // navigation, wait two frames so the destination editor owns layout first.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      store.setPendingEditorReveal({
        filePath,
        line,
        column: 1,
        matchLength: 0
      })
    })
  })
}

export type ImportGotoDefinitionContext = {
  filePath: string
  relativePath: string
  worktreeId: string | undefined
}

type ImportLinkCandidate = {
  range: IRange
  specifier: string
  symbol?: string
}

// Why: Monaco's link-provider registry is global per language, so every editor
// registers its own instance and filters to its own model — mirrors the
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
      const { filePath, relativePath, worktreeId } = getContext()
      if (!worktreeId) {
        return { links: [] }
      }
      const worktreeRoot = deriveMarkdownPreviewSourceRoot(filePath, relativePath)
      const content = model.getValue()
      const candidates: ImportLinkCandidate[] = [
        ...findImportSpecifierRanges(content),
        ...findImportSymbolRanges(content)
      ]
      const links = await Promise.all(
        candidates.map(async ({ range, specifier, symbol }) => {
          const target = await resolveImportSpecifierTarget(
            specifier,
            filePath,
            worktreeRoot,
            (path) => window.api.shell.pathExists(path)
          )
          if (!target) {
            return null
          }
          const query = new URLSearchParams({
            worktreeId,
            relativePath: target.relativePath,
            ...(symbol ? { symbol } : {})
          }).toString()
          return {
            range,
            tooltip: symbol ? 'Go to definition' : 'Open file',
            url: monaco.Uri.from({
              scheme: IMPORT_GOTO_DEFINITION_SCHEME,
              path: target.absolutePath,
              query
            })
          }
        })
      )
      return {
        links: links.filter((link): link is NonNullable<typeof link> => link !== null)
      }
    }
  })
}

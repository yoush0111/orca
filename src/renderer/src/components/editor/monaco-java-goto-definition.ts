import type { editor, IDisposable } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import {
  buildImportTargetUri,
  readContext,
  readTextFile,
  wholeLineRange,
  type ImportGotoDefinitionContext
} from './monaco-import-goto-definition'
import { classifyJavaClick } from './java-goto-definition-parsing'
import { resolveJavaDefinitionTarget } from './java-goto-definition-resolution'

/** Heuristic (no LSP) Java go-to-definition; same per-editor scoping as the TS provider. */
export function createJavaGotoDefinitionDefinitionProvider(
  editorInstance: editor.IStandaloneCodeEditor,
  getContext: () => ImportGotoDefinitionContext
): IDisposable {
  return monaco.languages.registerDefinitionProvider('java', {
    async provideDefinition(model, position) {
      if (model !== editorInstance.getModel()) {
        return null
      }
      const word = model.getWordAtPosition(position)
      const context = readContext(getContext)
      if (!word || !context) {
        return null
      }
      const lineText = model.getLineContent(position.lineNumber)
      const click = classifyJavaClick(lineText, word.startColumn - 1, word.endColumn - 1)
      if (!click) {
        return null
      }
      const target = await resolveJavaDefinitionTarget(
        model.getValue(),
        model.getOffsetAt(position),
        click,
        {
          filePath: context.filePath,
          worktreeRoot: context.worktreeRoot,
          pathExists: (path) => window.api.shell.pathExists(path),
          readFile: readTextFile
        }
      )
      if (!target) {
        return null
      }
      if (target.kind === 'same-file') {
        return {
          uri: model.uri,
          range: wholeLineRange(target.line, model.getLineMaxColumn(target.line))
        }
      }
      return {
        uri: buildImportTargetUri({
          absolutePath: target.absolutePath,
          relativePath: target.relativePath,
          worktreeId: context.worktreeId,
          line: target.line
        }),
        range: wholeLineRange(target.line, 1)
      }
    }
  })
}

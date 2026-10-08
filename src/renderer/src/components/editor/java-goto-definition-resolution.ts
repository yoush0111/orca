import { resolveRuntimePath } from '../../../../shared/cross-platform-path'
import {
  dirnameOfFilePath,
  findFirstExistingTarget,
  type ResolvedImportTarget
} from './import-goto-definition-resolution'
import {
  findJavaMethodDeclarationLine,
  findJavaTypeDeclarationLine,
  inferJavaVariableType,
  parseJavaImports,
  parseJavaPackage,
  type JavaClick
} from './java-goto-definition-parsing'

export type JavaDefinitionTarget =
  | { kind: 'same-file'; line: number }
  | ({ kind: 'file'; line: number } & ResolvedImportTarget)

export type JavaResolveDeps = {
  filePath: string
  worktreeRoot: string | null
  pathExists: (path: string) => Promise<boolean>
  readFile: (path: string) => Promise<string | null>
}

const WORKTREE_SOURCE_ROOTS = ['src/main/java', 'src/test/java']

/**
 * Source roots to look up `com/foo/Bar.java` under: the current file's own root
 * (derived from its package), its main/test sibling, then the worktree's.
 *
 * ponytail: other modules of a multi-module build are not searched.
 */
export function javaSourceRoots(
  filePath: string,
  packageName: string | null,
  worktreeRoot: string | null
): string[] {
  const dir = dirnameOfFilePath(filePath)
  const depth = packageName ? packageName.split('.').length : 0
  const ownRoot = depth ? resolveRuntimePath(dir, Array(depth).fill('..').join('/')) : dir
  const sibling = ownRoot.replace(
    /([\\/]src[\\/])(main|test)([\\/]java)$/,
    (_all, head: string, kind: string, tail: string) =>
      `${head}${kind === 'main' ? 'test' : 'main'}${tail}`
  )
  const worktreeRoots = worktreeRoot
    ? WORKTREE_SOURCE_ROOTS.map((root) => resolveRuntimePath(worktreeRoot, root))
    : []
  return [...new Set([ownRoot, sibling, ...worktreeRoots])]
}

/** Fully qualified candidates for simple type `name`: explicit import, else same package, then wildcard imports. */
export function javaTypeFqnCandidates(content: string, name: string): string[] {
  const imports = parseJavaImports(content).filter((entry) => !entry.isStatic)
  const explicit = imports.find((entry) => !entry.isWildcard && lastSegment(entry.path) === name)
  if (explicit) {
    return [explicit.path]
  }
  const packageName = parseJavaPackage(content)
  return [
    packageName ? `${packageName}.${name}` : name,
    ...imports.filter((entry) => entry.isWildcard).map((entry) => `${entry.path}.${name}`)
  ]
}

function lastSegment(fqn: string): string {
  return fqn.slice(fqn.lastIndexOf('.') + 1)
}

async function findTypeFile(
  content: string,
  fqns: string[],
  deps: JavaResolveDeps
): Promise<ResolvedImportTarget | null> {
  const roots = javaSourceRoots(deps.filePath, parseJavaPackage(content), deps.worktreeRoot)
  const candidates = fqns.flatMap((fqn) =>
    roots.map((root) => resolveRuntimePath(root, `${fqn.replace(/\./g, '/')}.java`))
  )
  return findFirstExistingTarget(candidates, deps.worktreeRoot, deps.pathExists)
}

async function findLineInFile(
  file: ResolvedImportTarget,
  deps: JavaResolveDeps,
  findLine: (text: string) => number | null
): Promise<number | null> {
  const text = await deps.readFile(file.absolutePath)
  return text === null ? null : findLine(text)
}

export async function resolveJavaDefinitionTarget(
  content: string,
  offset: number,
  click: JavaClick,
  deps: JavaResolveDeps
): Promise<JavaDefinitionTarget | null> {
  if (click.kind === 'import') {
    return resolveImportClick(content, click.classFqn, click.member, deps)
  }
  if (click.kind === 'type') {
    return resolveTypeClick(content, click.name, deps)
  }
  return resolveMethodClick(content, offset, click.name, click.receiver, deps)
}

async function resolveImportClick(
  content: string,
  classFqn: string,
  member: string | null,
  deps: JavaResolveDeps
): Promise<JavaDefinitionTarget | null> {
  const file = await findTypeFile(content, [classFqn], deps)
  if (!file) {
    return null
  }
  const line = await findLineInFile(file, deps, (text) => {
    const memberLine = member ? findJavaMethodDeclarationLine(text, member) : null
    return memberLine ?? findJavaTypeDeclarationLine(text, lastSegment(classFqn))
  })
  return { kind: 'file', ...file, line: line ?? 1 }
}

async function resolveTypeClick(
  content: string,
  name: string,
  deps: JavaResolveDeps
): Promise<JavaDefinitionTarget | null> {
  const localLine = findJavaTypeDeclarationLine(content, name)
  if (localLine !== null) {
    return { kind: 'same-file', line: localLine }
  }
  const file = await findTypeFile(content, javaTypeFqnCandidates(content, name), deps)
  if (!file) {
    return null
  }
  const line = await findLineInFile(file, deps, (text) => findJavaTypeDeclarationLine(text, name))
  return { kind: 'file', ...file, line: line ?? 1 }
}

async function resolveMethodClick(
  content: string,
  offset: number,
  name: string,
  receiver: string | null,
  deps: JavaResolveDeps
): Promise<JavaDefinitionTarget | null> {
  // A capitalized receiver with no declaration is a static call on that type.
  const typeName =
    receiver === null
      ? null
      : (inferJavaVariableType(content, receiver, offset) ??
        (/^[A-Z]/.test(receiver) ? receiver : null))
  // ponytail: a type declared in this file (incl. nested) searches the whole file.
  if (receiver === null || (typeName && findJavaTypeDeclarationLine(content, typeName) !== null)) {
    const line = findJavaMethodDeclarationLine(content, name)
    return line === null ? null : { kind: 'same-file', line }
  }
  if (!typeName) {
    return null
  }
  const file = await findTypeFile(content, javaTypeFqnCandidates(content, typeName), deps)
  if (!file) {
    return null
  }
  const line = await findLineInFile(file, deps, (text) => findJavaMethodDeclarationLine(text, name))
  return line === null ? null : { kind: 'file', ...file, line }
}

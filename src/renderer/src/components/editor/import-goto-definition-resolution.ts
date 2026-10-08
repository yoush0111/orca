import { relativePathInsideRoot, resolveRuntimePath } from '../../../../shared/cross-platform-path'

const RESOLVABLE_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx'
]

const ALIAS_PREFIX = '@/'
// ponytail: only this repo's single tsconfig alias ("@/*" -> "src/renderer/src/*") is
// handled; add a tsconfig-paths reader if more aliases show up.
const ALIAS_TARGET_DIR = 'src/renderer/src/'

export function dirnameOfFilePath(filePath: string): string {
  return filePath.replace(/[\\/][^\\/]*$/, '') || filePath
}

function importSpecifierCandidates(
  specifier: string,
  filePath: string,
  worktreeRoot: string | null
): string[] {
  let base: string
  let relative: string
  if (specifier.startsWith(ALIAS_PREFIX)) {
    if (!worktreeRoot) {
      return []
    }
    base = worktreeRoot
    relative = ALIAS_TARGET_DIR + specifier.slice(ALIAS_PREFIX.length)
  } else {
    base = dirnameOfFilePath(filePath)
    relative = specifier
  }
  const resolvedBase = resolveRuntimePath(base, relative)
  return RESOLVABLE_SUFFIXES.map((suffix) => `${resolvedBase}${suffix}`)
}

export type ResolvedImportTarget = { absolutePath: string; relativePath: string }

export async function resolveImportSpecifierTarget(
  specifier: string,
  filePath: string,
  worktreeRoot: string | null,
  pathExists: (path: string) => Promise<boolean>
): Promise<ResolvedImportTarget | null> {
  return findFirstExistingTarget(
    importSpecifierCandidates(specifier, filePath, worktreeRoot),
    worktreeRoot,
    pathExists
  )
}

export async function findFirstExistingTarget(
  candidates: string[],
  worktreeRoot: string | null,
  pathExists: (path: string) => Promise<boolean>
): Promise<ResolvedImportTarget | null> {
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      const relativePath =
        (worktreeRoot && relativePathInsideRoot(worktreeRoot, candidate)) || candidate
      return { absolutePath: candidate, relativePath }
    }
  }
  return null
}

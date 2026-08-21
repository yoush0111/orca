import type { RedmineProject } from './redmine-types'

/**
 * Resolves the repo a Redmine project starts workspaces in. Subprojects inherit
 * the nearest mapped ancestor, so only the parent needs an explicit mapping.
 * Returns null when nothing is mapped or the mapped repo is gone, letting the
 * composer fall back to its usual active-repo default.
 */
export function resolveRedmineRepoId({
  map,
  projectId,
  projects,
  eligibleRepoIds
}: {
  map: Record<string, string> | undefined
  projectId: number | null | undefined
  projects?: readonly RedmineProject[]
  eligibleRepoIds: readonly string[]
}): string | null {
  if (!map || typeof projectId !== 'number') {
    return null
  }
  const byId = new Map((projects ?? []).map((project) => [project.id, project]))
  const seen = new Set<number>()
  let currentId: number | null = projectId
  while (typeof currentId === 'number' && !seen.has(currentId)) {
    seen.add(currentId)
    const repoId = map[String(currentId)]
    if (repoId) {
      return eligibleRepoIds.includes(repoId) ? repoId : null
    }
    currentId = byId.get(currentId)?.parent?.id ?? null
  }
  return null
}

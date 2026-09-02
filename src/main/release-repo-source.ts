import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { MAIN_RELEASE_REPO } from '../shared/release-channel'

let cachedRepo: string | null = null

/**
 * The repo this installed build actually updates from. Fork builds publish
 * their own releases, so hardcoding upstream leaves them permanently stale;
 * electron-builder already stamps the right owner/repo into app-update.yml.
 */
function readInstalledReleaseRepo(): string {
  try {
    // Why `yaml`: already a dependency here (updater-prerelease-feed parses manifests with it).
    const parsed = parse(readFileSync(join(process.resourcesPath, 'app-update.yml'), 'utf8')) as {
      owner?: unknown
      repo?: unknown
    } | null
    const owner = typeof parsed?.owner === 'string' ? parsed.owner.trim() : ''
    const repo = typeof parsed?.repo === 'string' ? parsed.repo.trim() : ''
    return owner && repo ? `${owner}/${repo}` : MAIN_RELEASE_REPO
  } catch {
    // Dev runs have no app-update.yml, and a malformed one must never break update checks.
    return MAIN_RELEASE_REPO
  }
}

export function getInstalledReleaseRepo(): string {
  cachedRepo ??= readInstalledReleaseRepo()
  return cachedRepo
}

export function resetInstalledReleaseRepoCache(): void {
  cachedRepo = null
}

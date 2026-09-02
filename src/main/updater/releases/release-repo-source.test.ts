import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getInstalledReleaseRepo, resetInstalledReleaseRepoCache } from './release-repo-source'

const ORIGINAL_RESOURCES_PATH = process.resourcesPath
const tempDirs: string[] = []

function withResourcesPath(contents: string | null): void {
  const dir = mkdtempSync(join(tmpdir(), 'orca-app-update-'))
  tempDirs.push(dir)
  if (contents !== null) {
    writeFileSync(join(dir, 'app-update.yml'), contents, 'utf8')
  }
  Object.defineProperty(process, 'resourcesPath', { value: dir, configurable: true })
  resetInstalledReleaseRepoCache()
}

afterEach(() => {
  Object.defineProperty(process, 'resourcesPath', {
    value: ORIGINAL_RESOURCES_PATH,
    configurable: true
  })
  resetInstalledReleaseRepoCache()
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('getInstalledReleaseRepo', () => {
  it('reads owner/repo from the installed app-update.yml', () => {
    withResourcesPath(
      ['owner: yoush0111', 'repo: orca-releases', 'provider: github', 'releaseType: release'].join(
        '\n'
      )
    )
    expect(getInstalledReleaseRepo()).toBe('yoush0111/orca-releases')
  })

  it('falls back to the upstream repo when app-update.yml is missing', () => {
    withResourcesPath(null)
    expect(getInstalledReleaseRepo()).toBe('stablyai/orca')
  })

  it('falls back to the upstream repo on unparseable YAML instead of throwing', () => {
    withResourcesPath('owner: [unclosed\n\trepo: "')
    expect(getInstalledReleaseRepo()).toBe('stablyai/orca')
  })

  it('falls back to the upstream repo when owner or repo is absent', () => {
    withResourcesPath('provider: github\n')
    expect(getInstalledReleaseRepo()).toBe('stablyai/orca')
  })

  it('caches the resolved repo', () => {
    withResourcesPath('owner: yoush0111\nrepo: orca-releases\n')
    expect(getInstalledReleaseRepo()).toBe('yoush0111/orca-releases')
    Object.defineProperty(process, 'resourcesPath', {
      value: join(tmpdir(), 'orca-missing-resources'),
      configurable: true
    })
    expect(getInstalledReleaseRepo()).toBe('yoush0111/orca-releases')
  })
})

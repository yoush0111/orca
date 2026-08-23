import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNewerReleaseTag, getReleaseDownloadUrl } from './updater-prerelease-feed'
import { resetInstalledReleaseRepoCache } from './release-repo-source'

const { netFetchMock } = vi.hoisted(() => ({ netFetchMock: vi.fn() }))

vi.mock('electron', () => ({ net: { fetch: netFetchMock } }))

const ORIGINAL_RESOURCES_PATH = process.resourcesPath
const FORK_REPO = 'yoush0111/orca-releases'
let tempDir: string | null = null

function useForkAppUpdateYml(): void {
  tempDir = mkdtempSync(join(tmpdir(), 'orca-fork-feed-'))
  writeFileSync(
    join(tempDir, 'app-update.yml'),
    'owner: yoush0111\nrepo: orca-releases\nprovider: github\n',
    'utf8'
  )
  Object.defineProperty(process, 'resourcesPath', { value: tempDir, configurable: true })
  resetInstalledReleaseRepoCache()
}

beforeEach(() => {
  netFetchMock.mockReset()
  useForkAppUpdateYml()
})

afterEach(() => {
  Object.defineProperty(process, 'resourcesPath', {
    value: ORIGINAL_RESOURCES_PATH,
    configurable: true
  })
  resetInstalledReleaseRepoCache()
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('fork release feed', () => {
  it('points the download base at the fork repo', () => {
    expect(getReleaseDownloadUrl('v1.2.3')).toBe(
      `https://github.com/${FORK_REPO}/releases/download/v1.2.3`
    )
  })

  it('reads the atom feed and manifests from the fork repo', async () => {
    netFetchMock.mockImplementation((url: string) => {
      if (url === `https://github.com/${FORK_REPO}/releases.atom`) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              `<feed><entry><link href="https://github.com/${FORK_REPO}/releases/tag/v1.2.3"/></entry></feed>`
            )
        })
      }
      if (url.endsWith('.yml')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('version: 1.2.3\npath: Orca-1.2.3-arm64-mac.zip\n')
        })
      }
      return Promise.resolve({ ok: true, status: 200 })
    })
    expect(await fetchNewerReleaseTag('1.2.2')).toBe('v1.2.3')
    const urls = netFetchMock.mock.calls.map(([url]) => String(url))
    expect(urls[0]).toBe(`https://github.com/${FORK_REPO}/releases.atom`)
    expect(urls.every((url) => !url.includes('stablyai/orca'))).toBe(true)
  })
})

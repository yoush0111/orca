import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectWeeklyReportCommits } from './weekly-report-git'

describe('weekly report git scan against real Git', () => {
  const tempPaths: string[] = []

  afterEach(() => {
    for (const path of tempPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true })
    }
  })

  it('matches by message and by commits unique to an issue branch, for the viewer only', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'orca-weekly-git-'))
    tempPaths.push(repoPath)
    const git = (args: string[], env: Record<string, string> = {}): string =>
      execFileSync('git', args, {
        cwd: repoPath,
        encoding: 'utf8',
        env: { ...process.env, ...env }
      })
    let fileIndex = 0
    const commit = (message: string, date: string, email = 'me@example.test'): void => {
      fileIndex += 1
      writeFileSync(join(repoPath, `f${fileIndex}.txt`), message)
      git(['add', '.'])
      git(['commit', '--quiet', '-m', message], {
        GIT_AUTHOR_EMAIL: email,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date
      })
    }

    git(['init', '--quiet', '--initial-branch=main'])
    git(['config', 'user.name', 'Me'])
    git(['config', 'user.email', 'me@example.test'])
    git(['config', 'commit.gpgSign', 'false'])
    git(['config', 'core.hooksPath', '.git/no-hooks'])
    commit('base', '2026-09-01T00:00:00Z')
    commit('fix: 경계값 수정 #1234', '2026-10-02T00:00:00Z')
    // Branch with no unique commits: main's #1234 commit must not be attributed to it.
    git(['branch', 'feature/5970-empty'])
    git(['checkout', '--quiet', '-b', 'feature/5969-slug'])
    commit('작업 A', '2026-10-03T00:00:00Z')
    commit('남의 작업', '2026-10-03T01:00:00Z', 'ba-me@example.test')
    commit('기간 밖', '2026-10-20T00:00:00Z')
    git(['checkout', '--quiet', 'main'])

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await collectWeeklyReportCommits(
      [
        { path: repoPath, displayName: 'repo' },
        { path: join(repoPath, 'missing'), displayName: 'gone' }
      ],
      { since: '2026-10-01T00:00:00.000Z', until: '2026-10-08T00:00:00.000Z' }
    )
    warn.mockRestore()

    const subjects = Object.fromEntries(
      [...result.byIssue].map(([id, commits]) => [id, commits.map((c) => c.subject)])
    )
    expect(subjects).toEqual({ 1234: ['fix: 경계값 수정 #1234'], 5969: ['작업 A'] })
    expect(result.repoCount).toBe(1)
  })
})

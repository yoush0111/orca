import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { mapWithConcurrency } from '../../shared/map-with-concurrency'
import {
  issueIdFromBranchName,
  matchCommitsToIssues,
  type WeeklyReportCommit,
  type WeeklyReportGitCommit
} from '../../shared/redmine-weekly-report-commits'
import { isGitRepoKind } from '../../shared/repo-kind'
import type { Repo } from '../../shared/repo-types'
import { getDefaultBaseRefAsync, gitExecOptions } from '../git/repo-default-base-ref'
import { gitExecFileAsync } from '../git/runner'

export type WeeklyReportRepo = Pick<
  Repo,
  'path' | 'displayName' | 'kind' | 'connectionId' | 'executionHostId'
>

type GitRange = { since: string; until: string }

const REPO_CONCURRENCY = 3
const BRANCH_CONCURRENCY = 4
const GIT_TIMEOUT_MS = 30_000
const LOG_FORMAT = '--format=%x1e%H%x1f%cI%x1f%s%x1f%B'

/** Only git repos this process can reach; SSH/runtime-host repos are scanned by their own host. */
export function weeklyReportGitRepos(repos: readonly WeeklyReportRepo[]): WeeklyReportRepo[] {
  return repos.filter(
    (repo) => isGitRepoKind(repo) && getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID
  )
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await gitExecFileAsync(args, {
    ...gitExecOptions(repoPath),
    timeout: GIT_TIMEOUT_MS
  })
  return stdout
}

function parseLog(stdout: string, repo: string): WeeklyReportGitCommit[] {
  return stdout.split('\x1e').flatMap((record) => {
    const [hash, committedOn, subject, message] = record.split('\x1f')
    return hash?.trim() && message !== undefined
      ? [{ hash: hash.trim(), committedOn, subject, message, repo }]
      : []
  })
}

/** Issue id → hashes on matching branches that the default branch does not already have. */
async function branchCommits(
  repoPath: string,
  filters: string[]
): Promise<Map<number, Set<string>>> {
  const refs = (
    await git(repoPath, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'])
  )
    .split('\n')
    .flatMap((ref) => {
      const id = issueIdFromBranchName(ref.trim().replace(/^refs\/(?:heads|remotes)\//, ''))
      return id === null ? [] : [{ ref: ref.trim(), id }]
    })
  const out = new Map<number, Set<string>>()
  const defaultRef = refs.length > 0 ? await getDefaultBaseRefAsync(repoPath) : null
  // Without a default branch "unique to the branch" is undefined, so branch matching is skipped.
  if (!defaultRef) {
    return out
  }
  await mapWithConcurrency(refs, BRANCH_CONCURRENCY, async ({ ref, id }) => {
    const stdout = await git(repoPath, ['log', ref, '--not', defaultRef, ...filters, '--format=%H'])
    const hashes = out.get(id) ?? new Set<string>()
    for (const hash of stdout.split('\n')) {
      if (hash.trim()) {
        hashes.add(hash.trim())
      }
    }
    out.set(id, hashes)
  })
  return out
}

async function scanRepo(
  repo: WeeklyReportRepo,
  range: GitRange
): Promise<{ commits: WeeklyReportGitCommit[]; branches: Map<number, Set<string>> } | null> {
  const email = (await git(repo.path, ['config', '--default', '', '--get', 'user.email'])).trim()
  if (!email) {
    return null
  }
  const filters = [
    '--no-merges',
    `--since=${range.since}`,
    `--until=${range.until}`,
    // Fixed string with brackets so a@x.com does not also match ba@x.com.
    '--fixed-strings',
    `--author=<${email}>`
  ]
  const commits = parseLog(
    await git(repo.path, ['log', '--all', ...filters, LOG_FORMAT]),
    repo.displayName
  )
  if (commits.length === 0) {
    return { commits, branches: new Map() }
  }
  return { commits, branches: await branchCommits(repo.path, filters) }
}

/**
 * The viewer's commits in range, keyed by the Redmine issue they belong to.
 * A failing repo is logged and skipped so the report still renders.
 */
export async function collectWeeklyReportCommits(
  repos: readonly WeeklyReportRepo[],
  range: GitRange
): Promise<{ byIssue: Map<number, WeeklyReportCommit[]>; repoCount: number }> {
  const scans = await mapWithConcurrency(repos, REPO_CONCURRENCY, async (repo) => {
    try {
      return await scanRepo(repo, range)
    } catch (error) {
      console.warn('[redmine] weekly report git scan skipped repo', {
        repo: repo.displayName,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  })
  const commits: WeeklyReportGitCommit[] = []
  const branches = new Map<number, Set<string>>()
  for (const scan of scans) {
    commits.push(...(scan?.commits ?? []))
    for (const [id, hashes] of scan?.branches ?? []) {
      branches.set(id, new Set([...(branches.get(id) ?? []), ...hashes]))
    }
  }
  return {
    byIssue: matchCommitsToIssues(commits, branches),
    repoCount: scans.filter(Boolean).length
  }
}

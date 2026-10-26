// Pure matching of git commits to Redmine issues for the weekly report. No I/O.

export type WeeklyReportCommit = {
  hash: string
  subject: string
  /** Committer date, ISO. */
  committedOn: string
  repo: string
  /** Bullet lines (`- `/`* `) from the message body; optional for hosts that predate it. */
  body?: string[]
}

/** One `git log` record before it is tied to issues. */
export type WeeklyReportGitCommit = WeeklyReportCommit & { message: string }

// `&#123;` entities and `foo#1` anchors are not issue references.
const MESSAGE_ISSUE_REF = /(?<![\w&])#(\d+)\b/g
const BRANCH_ISSUE_ID = /(?:^|\/)(\d{3,})-/

export function issueIdsFromCommitMessage(message: string): number[] {
  return [...new Set([...message.matchAll(MESSAGE_ISSUE_REF)].map((m) => Number(m[1])))]
}

/** `feature/5969-slug`, `origin/bugfix/1234-x` → the issue id; null when the name has none. */
export function issueIdFromBranchName(name: string): number | null {
  const match = BRANCH_ISSUE_ID.exec(name)
  return match ? Number(match[1]) : null
}

/**
 * Body bullets below the subject, with indented wrap lines joined back on.
 * Trailers and prose never start with a bullet, so they drop out.
 */
export function commitBodyBullets(message: string): string[] {
  const out: string[] = []
  let open = false
  for (const line of message.replace(/\r\n?/g, '\n').split('\n').slice(1)) {
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line)
    if (bullet) {
      out.push(bullet[1].trim())
    } else if (open && /^\s+\S/.test(line)) {
      out[out.length - 1] += ` ${line.trim()}`
      continue
    }
    open = Boolean(bullet)
  }
  return out
}

/**
 * Merges message references, branch membership, and hash prefixes written in an
 * issue's description into issue id → commits, listing a commit once per issue
 * however many paths matched it.
 */
export function matchCommitsToIssues(
  commits: readonly WeeklyReportGitCommit[],
  branchCommits: ReadonlyMap<number, ReadonlySet<string>>,
  hashHints: ReadonlyMap<number, readonly string[]> = new Map()
): Map<number, WeeklyReportCommit[]> {
  const byHash = new Map(commits.map((c) => [c.hash, c]))
  const idsByHash = new Map<string, Set<number>>()
  const add = (hash: string, id: number): void => {
    idsByHash.set(hash, (idsByHash.get(hash) ?? new Set()).add(id))
  }
  for (const commit of commits) {
    for (const id of issueIdsFromCommitMessage(commit.message)) {
      add(commit.hash, id)
    }
  }
  for (const [id, hashes] of branchCommits) {
    for (const hash of hashes) {
      if (byHash.has(hash)) {
        add(hash, id)
      }
    }
  }
  for (const [id, prefixes] of hashHints) {
    for (const hash of byHash.keys()) {
      if (prefixes.some((prefix) => hash.startsWith(prefix))) {
        add(hash, id)
      }
    }
  }
  const out = new Map<number, WeeklyReportCommit[]>()
  for (const { hash, subject, committedOn, repo, message } of byHash.values()) {
    const commit = { hash, subject, committedOn, repo, body: commitBodyBullets(message) }
    for (const id of idsByHash.get(hash) ?? []) {
      out.set(id, [...(out.get(id) ?? []), commit])
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => Date.parse(a.committedOn) - Date.parse(b.committedOn))
  }
  return out
}

const CONVENTIONAL_PREFIX = /^\s*[a-z]+(?:\([^)]*\))?!?:\s*/i

/** Drops `feat(x):` style prefixes and the issue's own `#id`, which the issue line already shows. */
export function cleanCommitSubject(subject: string, issueId: number): string {
  return subject
    .replace(CONVENTIONAL_PREFIX, '')
    .replace(new RegExp(`\\s*[[(]?#${issueId}\\b[\\])]?`, 'g'), '')
    .trim()
}

export function normalizeReportSentence(text: string): string {
  return text.replace(/…$/, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

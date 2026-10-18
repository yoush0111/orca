import { execFileSync } from 'node:child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

/**
 * The full commit this build is made from. Official skill installs pin to it, so the
 * skills an Orca build installs are the ones it bundles on every release channel.
 */
export function resolveBuildSourceCommit() {
  let commit = ''
  try {
    commit = process.env.ORCA_FORK_PUBLISH_OWNER
      ? resolveUpstreamReleaseCommit()
      : git(['rev-parse', 'HEAD'])
  } catch (error) {
    throw new Error(
      `Could not read the source commit with \`git rev-parse HEAD\`: ${
        error instanceof Error ? error.message : String(error)
      }. Orca builds must run from a git checkout so official skills can pin to it.`
    )
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`\`git rev-parse HEAD\` returned "${commit}", not a full commit hash.`)
  }
  return commit
}

// Why: skill installs fetch stablyai/orca, which lacks fork-only commits. Pin a fork build to the
// upstream release it is rebased on; the fork adds skills but never edits upstream ones.
function resolveUpstreamReleaseCommit() {
  const tag = git([
    'describe',
    '--tags',
    '--abbrev=0',
    '--match',
    'v[0-9]*',
    '--exclude',
    '*-personal',
    'HEAD'
  ])
  return git(['rev-parse', `${tag}^{commit}`])
}

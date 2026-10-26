import { describe, expect, it } from 'vitest'
import {
  cleanCommitSubject,
  issueIdFromBranchName,
  issueIdsFromCommitMessage,
  matchCommitsToIssues,
  type WeeklyReportGitCommit
} from './redmine-weekly-report-commits'

function commit(hash: string, message: string, committedOn = '2026-10-05T00:00:00Z') {
  return {
    hash,
    subject: message.split('\n')[0],
    message,
    committedOn,
    repo: 'orca'
  } satisfies WeeklyReportGitCommit
}

describe('issue references', () => {
  it('reads #id from the whole message but not entities or anchors', () => {
    expect(
      issueIdsFromCommitMessage('fix: crash #1234\n\nrefs #77 and #1234, see a#9 &#160;')
    ).toEqual([1234, 77])
  })

  it('takes the id from a branch segment that starts with digits and a dash', () => {
    expect(issueIdFromBranchName('feature/5969-slug')).toBe(5969)
    expect(issueIdFromBranchName('origin/bugfix/1234-x')).toBe(1234)
    expect(issueIdFromBranchName('5970-direct')).toBe(5970)
    // Too short, or digits that are not a leading segment.
    expect(issueIdFromBranchName('feature/12-x')).toBeNull()
    expect(issueIdFromBranchName('upstream/1.4.129-rc7')).toBeNull()
    expect(issueIdFromBranchName('feature/v1234-x')).toBeNull()
  })
})

describe('matchCommitsToIssues', () => {
  it('lists a commit once per issue when message and branch both match', () => {
    const byIssue = matchCommitsToIssues(
      [
        commit('b', 'second #5969', '2026-10-06T00:00:00Z'),
        commit('a', 'first'),
        commit('c', 'loose')
      ],
      new Map([[5969, new Set(['a', 'b', 'unknown'])]])
    )
    expect(byIssue.get(5969)?.map((c) => c.hash)).toEqual(['a', 'b'])
    expect([...byIssue.keys()]).toEqual([5969])
  })

  it('ties commits to an issue by hash prefixes from its description and keeps body bullets', () => {
    const feat = commit(
      '2ef9b68aa11',
      'feat: 병원 의뢰서 일괄 출력\n\n- 툴바에 의뢰서 출력 버튼 추가\n본문 설명\n\nCo-Authored-By: X <x@y>'
    )
    const byIssue = matchCommitsToIssues(
      [feat, commit('9999999', 'other')],
      new Map(),
      new Map([[6536, ['2ef9b68']]])
    )
    expect(byIssue.get(6536)).toEqual([
      expect.objectContaining({ hash: '2ef9b68aa11', body: ['툴바에 의뢰서 출력 버튼 추가'] })
    ])
    expect([...byIssue.keys()]).toEqual([6536])
  })
})

describe('cleanCommitSubject', () => {
  it('drops conventional prefixes and the issue’s own reference', () => {
    expect(cleanCommitSubject('feat(report)!: 커밋 보충 (#5969)', 5969)).toBe('커밋 보충')
    expect(cleanCommitSubject('fix: #5969 경계값 수정 refs #12', 5969)).toBe('경계값 수정 refs #12')
    expect(cleanCommitSubject('Update README', 1)).toBe('Update README')
  })
})

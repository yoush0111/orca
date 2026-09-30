import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  // Why: format.ts narrows with `instanceof` against the real error classes.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { okFixture, queueFixtures } from '../test-fixtures'

const detail = {
  id: 42,
  subject: 'Fix login',
  description: 'Steps',
  doneRatio: 30,
  project: { id: 1, name: 'Web' },
  status: { id: 2, name: 'New' },
  assignedTo: null,
  tracker: { id: 1, name: 'Bug' },
  url: 'https://rm.example/issues/42',
  journals: [{ id: 9, author: 'Kim', createdAt: '2026-09-01T00:00:00Z', notes: '확인 필요' }],
  attachments: [
    { filename: 'a.png', filesize: 120, url: 'https://rm.example/attachments/download/1/a.png' }
  ]
}

describe('orca redmine CLI handlers', () => {
  const logs: string[] = []

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    logs.length = 0
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation((line: string) => void logs.push(line))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows an issue with comments and attachments', async () => {
    queueFixtures(callMock, okFixture('req_rm', detail))

    await main(['redmine', 'issue', 'show', '42'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('redmine.issueShow', { id: 42 })
    const out = logs.join('\n')
    expect(out).toContain('#42 [Bug] Fix login')
    expect(out).toContain('확인 필요')
    expect(out).toContain('a.png')
  })

  it('adds a note from --body', async () => {
    queueFixtures(callMock, okFixture('req_rm', { ok: true, id: 42 }))

    await main(['redmine', 'issue', 'note', '42', '--body', '### 결정사항'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('redmine.issueAddNote', {
      id: 42,
      notes: '### 결정사항'
    })
    expect(logs.join('\n')).toContain('Added note to #42')
  })

  it('rejects both --body and --body-file, and neither', async () => {
    await main(
      ['redmine', 'issue', 'note', '42', '--body', 'a', '--body-file', 'x.md'],
      '/tmp/repo'
    )
    await main(['redmine', 'issue', 'note', '42'], '/tmp/repo')
    expect(callMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('rejects a missing or non-numeric id', async () => {
    await main(['redmine', 'issue', 'show', 'abc'], '/tmp/repo')
    expect(callMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})

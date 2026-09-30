import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { RpcRequest } from '../core'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { REDMINE_METHODS } from './redmine'

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

function makeDispatcher() {
  const runtime = {
    getRuntimeId: () => 'test-runtime',
    redmineIssueShow: vi.fn().mockResolvedValue({ id: 3 }),
    redmineIssueAddNote: vi.fn().mockResolvedValue({ ok: true, id: 3 })
  }
  const dispatcher = new RpcDispatcher({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test double implements only the methods these RPCs call.
    runtime: runtime as unknown as OrcaRuntimeService,
    methods: REDMINE_METHODS
  })
  return { runtime, dispatcher }
}

describe('redmine agent RPC methods', () => {
  it('routes issueShow and issueAddNote with trimmed notes', async () => {
    const { runtime, dispatcher } = makeDispatcher()

    expect((await dispatcher.dispatch(makeRequest('redmine.issueShow', { id: 3 }))).ok).toBe(true)
    expect(runtime.redmineIssueShow).toHaveBeenCalledWith(3)

    await dispatcher.dispatch(makeRequest('redmine.issueAddNote', { id: 3, notes: '  결정  ' }))
    expect(runtime.redmineIssueAddNote).toHaveBeenCalledWith(3, '결정')
  })

  it('rejects non-positive ids and empty notes', async () => {
    const { runtime, dispatcher } = makeDispatcher()

    expect((await dispatcher.dispatch(makeRequest('redmine.issueShow', { id: 0 }))).ok).toBe(false)
    expect(
      (await dispatcher.dispatch(makeRequest('redmine.issueAddNote', { id: 3, notes: '   ' }))).ok
    ).toBe(false)
    expect(runtime.redmineIssueShow).not.toHaveBeenCalled()
    expect(runtime.redmineIssueAddNote).not.toHaveBeenCalled()
  })
})

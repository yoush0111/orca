import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.mock('electron', () => ({
  net: { fetch: (...args: unknown[]) => fetchMock(...args) },
  session: { defaultSession: {} }
}))
vi.mock('../network/proxy-settings', () => ({
  ensureElectronProxyFromEnvironment: vi.fn().mockResolvedValue(undefined)
}))

const record = {
  version: 1,
  baseUrl: 'https://rm.example',
  viewerId: 1,
  login: 'kim',
  displayName: 'Kim',
  email: null
}
const credentialState: { record: typeof record | null; apiKey: string | null } = {
  record,
  apiKey: 'secret'
}
vi.mock('./credential-store', () => ({
  readConnectionRecord: () => credentialState.record,
  readApiKey: () => credentialState.apiKey,
  hasStoredApiKey: () => credentialState.apiKey !== null,
  getCredentialError: () => null,
  saveConnection: vi.fn(),
  clearConnection: vi.fn()
}))

import { addIssueNote, getIssue, listProjects } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('redmine client issue detail and notes', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    credentialState.record = record
    credentialState.apiKey = 'secret'
  })

  it('fetches issue detail with journals and attachments via header auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { issue: { id: 5, subject: 's' } }))

    const detail = await getIssue(5)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://rm.example/issues/5.json?include=journals,attachments')
    expect(init.headers['X-Redmine-API-Key']).toBe('secret')
    expect(detail.id).toBe(5)
  })

  it('PUTs a UTF-8 note body and accepts 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await addIssueNote(5, '### 결정사항\n- 결정: A안')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://rm.example/issues/5.json')
    expect(init.method).toBe('PUT')
    expect(init.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(JSON.parse(init.body)).toEqual({ issue: { notes: '### 결정사항\n- 결정: A안' } })
  })

  it('reports 404 and 422 with status-specific messages', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}))
    await expect(getIssue(99)).rejects.toThrow('Redmine issue not found (404).')

    fetchMock.mockResolvedValueOnce(jsonResponse(422, { errors: ['Notes is too long'] }))
    await expect(addIssueNote(5, 'x')).rejects.toThrow(
      'Redmine rejected the request (422): Notes is too long'
    )
  })

  it('throws when Redmine is not connected', async () => {
    credentialState.record = null
    await expect(getIssue(5)).rejects.toThrow('Redmine is not connected.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the generic 404 message for non-issue endpoints', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}))
    await expect(listProjects()).rejects.toThrow('Redmine request failed (404).')
  })

  it('reports 403 as a permission denial, not a rejected key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}))
    await expect(addIssueNote(5, 'x')).rejects.toThrow(
      'Redmine denied permission for this action (403).'
    )
  })

  it('treats a 200 note response with an empty body as success', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    await expect(addIssueNote(5, 'x')).resolves.toBeUndefined()
  })
})

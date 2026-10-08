import { z } from 'zod'
import { ensureElectronProxyFromEnvironment } from '../network/proxy-settings'
import { getMainHttpClient } from '../network/http-client'
import { CredentialDecryptionError } from '../integration-credential-file'
import type {
  RedmineConnectArgs,
  RedmineConnectResult,
  RedmineConnectionStatus,
  RedmineIssue,
  RedmineIssueDetail,
  RedmineIssueQuery,
  RedmineNamedRef,
  RedmineProject
} from '../../shared/redmine-types'
import {
  buildRedmineIssuesQuery,
  normalizeRedmineBaseUrl,
  parseRedmineIssueDetail,
  parseRedmineIssues,
  parseRedmineProjects,
  parseRedmineStatuses,
  parseRedmineViewer
} from './rest-contract'
import {
  clearConnection,
  getCredentialError,
  hasStoredApiKey,
  readApiKey,
  readConnectionRecord,
  saveConnection
} from './credential-store'

const REQUEST_TIMEOUT_MS = 20_000

export class RedmineApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'RedmineApiError'
    this.status = status
  }
}

const RedmineErrorsSchema = z.object({ errors: z.array(z.string()) })

type RedmineRequestInit = { method?: 'GET' | 'PUT'; body?: unknown; notFoundMessage?: string }

async function describeFailure(
  response: Response,
  notFoundMessage: string | undefined
): Promise<string> {
  if (response.status === 401) {
    return 'Redmine rejected the API key.'
  }
  if (response.status === 403) {
    return 'Redmine denied permission for this action (403).'
  }
  if (response.status === 404 && notFoundMessage) {
    return notFoundMessage
  }
  if (response.status === 422) {
    const parsed = RedmineErrorsSchema.safeParse(await response.json().catch(() => null))
    const errors = parsed.success ? parsed.data.errors.join('; ') : ''
    return `Redmine rejected the request (422)${errors ? `: ${errors}` : ''}`
  }
  return `Redmine request failed (${response.status}).`
}

async function redmineRequest(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RedmineRequestInit = {}
): Promise<unknown> {
  const url = `${baseUrl}${path}`
  const httpClient = getMainHttpClient()
  const proxySession = httpClient.proxySession()
  await ensureElectronProxyFromEnvironment({
    ...(proxySession ? { proxySession } : {}),
    probeUrl: url
  }).catch(() => {
    // Proxy discovery is best-effort; the request below reports the real failure.
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    // Why the port: on the desktop this is Electron's net.fetch (Chromium proxy/session,
    // no stale keep-alive sockets after VPN changes); a host without Chromium gets Node's fetch.
    const response = await httpClient.fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        // Redmine's own header auth — never put the key in the query string,
        // where proxies and access logs would capture it.
        'X-Redmine-API-Key': apiKey,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' })
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: controller.signal
    })
    if (!response.ok) {
      throw new RedmineApiError(
        await describeFailure(response, init.notFoundMessage),
        response.status
      )
    }
    // Why: a write's response body is irrelevant; parsing an empty 200 would report a landed note as failed.
    return init.method === 'PUT' || response.status === 204 ? null : await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

export function redmineGet(baseUrl: string, apiKey: string, path: string): Promise<unknown> {
  return redmineRequest(baseUrl, apiKey, path)
}

export type ActiveClient = { baseUrl: string; apiKey: string }

/** Throws CredentialDecryptionError so the renderer can surface the decrypt banner. */
function getClient(): ActiveClient | null {
  const record = readConnectionRecord()
  if (!record) {
    return null
  }
  const apiKey = readApiKey()
  return apiKey ? { baseUrl: record.baseUrl, apiKey } : null
}

export function getStatus(): RedmineConnectionStatus {
  const record = readConnectionRecord()
  const connected = record !== null && hasStoredApiKey()
  const credentialError = getCredentialError()
  return {
    connected,
    connection:
      connected && record
        ? {
            baseUrl: record.baseUrl,
            viewer: {
              id: record.viewerId,
              login: record.login,
              displayName: record.displayName,
              email: record.email
            }
          }
        : null,
    ...(credentialError ? { credentialError } : {})
  }
}

export async function connect(args: RedmineConnectArgs): Promise<RedmineConnectResult> {
  let baseUrl: string
  try {
    baseUrl = normalizeRedmineBaseUrl(args.baseUrl)
  } catch {
    return { ok: false, error: 'Enter a valid Redmine base URL.' }
  }
  const apiKey = args.apiKey.trim()
  if (!apiKey) {
    return { ok: false, error: 'API key is required.' }
  }
  try {
    const viewer = parseRedmineViewer(await redmineGet(baseUrl, apiKey, '/users/current.json'))
    saveConnection(
      {
        version: 1,
        baseUrl,
        viewerId: viewer.id,
        login: viewer.login,
        displayName: viewer.displayName,
        email: viewer.email
      },
      apiKey
    )
    return { ok: true, viewer }
  } catch (error) {
    console.error('[redmine] connect failed', {
      baseUrl,
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reach Redmine.'
    }
  }
}

export function disconnect(): void {
  clearConnection()
}

export async function testConnection(): Promise<RedmineConnectResult> {
  let client: ActiveClient | null
  try {
    client = getClient()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof CredentialDecryptionError ? error.message : 'Test failed'
    }
  }
  if (!client) {
    return { ok: false, error: 'Redmine is not connected.' }
  }
  try {
    const viewer = parseRedmineViewer(
      await redmineGet(client.baseUrl, client.apiKey, '/users/current.json')
    )
    return { ok: true, viewer }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Test failed' }
  }
}

export async function listIssues(query: RedmineIssueQuery = {}): Promise<RedmineIssue[]> {
  const client = getClient()
  if (!client) {
    return []
  }
  const payload = await redmineGet(
    client.baseUrl,
    client.apiKey,
    `/issues.json?${buildRedmineIssuesQuery(query)}`
  )
  return parseRedmineIssues(payload, client.baseUrl)
}

export async function listProjects(): Promise<RedmineProject[]> {
  const client = getClient()
  if (!client) {
    return []
  }
  return parseRedmineProjects(
    await redmineGet(client.baseUrl, client.apiKey, '/projects.json?limit=100')
  )
}

export async function listStatuses(): Promise<RedmineNamedRef[]> {
  const client = getClient()
  if (!client) {
    return []
  }
  return parseRedmineStatuses(
    await redmineGet(client.baseUrl, client.apiKey, '/issue_statuses.json')
  )
}

const ISSUE_NOT_FOUND = 'Redmine issue not found (404).'

export function requireClient(): ActiveClient {
  const client = getClient()
  if (!client) {
    throw new Error('Redmine is not connected.')
  }
  return client
}

export async function getIssue(id: number): Promise<RedmineIssueDetail> {
  const client = requireClient()
  const payload = await redmineRequest(
    client.baseUrl,
    client.apiKey,
    `/issues/${id}.json?include=journals,attachments`,
    { notFoundMessage: ISSUE_NOT_FOUND }
  )
  return parseRedmineIssueDetail(payload, client.baseUrl)
}

export async function addIssueNote(id: number, notes: string): Promise<void> {
  const client = requireClient()
  await redmineRequest(client.baseUrl, client.apiKey, `/issues/${id}.json`, {
    method: 'PUT',
    body: { issue: { notes } },
    notFoundMessage: ISSUE_NOT_FOUND
  })
}

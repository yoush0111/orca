import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken,
  writeEncryptedCredential
} from '../integration-credential-file'

export type RedmineConnectionRecord = {
  version: 1
  baseUrl: string
  viewerId: number
  login: string
  displayName: string
  email: string | null
}

let cachedRecord: RedmineConnectionRecord | null = null
let recordLoaded = false
let cachedApiKey: string | null = null
// Why: a decrypt failure is recorded so getStatus can explain failing reads
// without re-touching the keychain on every status poll.
let credentialError: string | null = null

function orcaDir(): string {
  return join(homedir(), '.orca')
}

function recordPath(): string {
  return join(orcaDir(), 'redmine-connection.json')
}

function keyPath(): string {
  return join(orcaDir(), 'redmine-api-key.enc')
}

function ensureOrcaDir(): void {
  const dir = orcaDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function getCredentialError(): string | null {
  return credentialError
}

export function hasStoredApiKey(): boolean {
  return cachedApiKey !== null || credentialFileHasContent(keyPath())
}

function normalizeRecord(input: unknown): RedmineConnectionRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  const raw = input as Record<string, unknown>
  if (
    typeof raw.baseUrl !== 'string' ||
    typeof raw.login !== 'string' ||
    typeof raw.displayName !== 'string' ||
    typeof raw.viewerId !== 'number'
  ) {
    return null
  }
  return {
    version: 1,
    baseUrl: raw.baseUrl,
    viewerId: raw.viewerId,
    login: raw.login,
    displayName: raw.displayName,
    email: typeof raw.email === 'string' ? raw.email : null
  }
}

export function readConnectionRecord(): RedmineConnectionRecord | null {
  if (recordLoaded) {
    return cachedRecord
  }
  recordLoaded = true
  const path = recordPath()
  if (!existsSync(path)) {
    cachedRecord = null
    return null
  }
  try {
    cachedRecord = normalizeRecord(JSON.parse(readFileSync(path, { encoding: 'utf-8' })))
  } catch {
    cachedRecord = null
  }
  return cachedRecord
}

export function saveConnection(record: RedmineConnectionRecord, apiKey: string): void {
  ensureOrcaDir()
  writeEncryptedCredential('Redmine', keyPath(), apiKey)
  writeFileSync(recordPath(), JSON.stringify(record, null, 2), {
    encoding: 'utf-8',
    mode: 0o600
  })
  cachedRecord = record
  recordLoaded = true
  cachedApiKey = apiKey
  credentialError = null
}

/** Throws CredentialDecryptionError when a stored key cannot be decrypted. */
export function readApiKey(): string | null {
  if (cachedApiKey !== null) {
    return cachedApiKey
  }
  const path = keyPath()
  if (!existsSync(path)) {
    return null
  }
  try {
    const key = readStoredCredentialToken('Redmine', readFileSync(path))
    if (key) {
      cachedApiKey = key
    }
    credentialError = null
    return key
  } catch (error) {
    if (error instanceof CredentialDecryptionError) {
      credentialError = error.message
      throw error
    }
    return null
  }
}

export function clearConnection(): void {
  cachedRecord = null
  recordLoaded = true
  cachedApiKey = null
  credentialError = null
  for (const path of [keyPath(), recordPath()]) {
    try {
      unlinkSync(path)
    } catch {
      // Nothing stored — safe to ignore.
    }
  }
}

/** Test seam: drop in-memory caches so a fresh read hits disk again. */
export function _resetRedmineCredentialCache(): void {
  cachedRecord = null
  recordLoaded = false
  cachedApiKey = null
  credentialError = null
}

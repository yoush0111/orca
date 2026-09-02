import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type {
  RedmineConnectArgs,
  RedmineConnectResult,
  RedmineConnectionStatus
} from '../../../../shared/redmine-types'
import {
  DISCONNECTED_REDMINE_STATUS,
  redmineConnect,
  redmineDisconnect,
  redmineStatus,
  redmineTestConnection
} from '@/runtime/runtime-redmine-client'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'

// Why: a status read that lands after the runtime switched belongs to the old
// host, so every write re-checks the generation and the context key.
let statusReadGeneration = 0

export type RedmineSlice = {
  redmineStatus: RedmineConnectionStatus
  redmineStatusChecked: boolean
  redmineStatusContextKey: string | null

  checkRedmineConnection: () => Promise<void>
  connectRedmine: (args: RedmineConnectArgs) => Promise<RedmineConnectResult>
  testRedmineConnection: () => Promise<RedmineConnectResult>
  disconnectRedmine: () => Promise<void>
}

export const createRedmineSlice: StateCreator<AppState, [], [], RedmineSlice> = (set, get) => ({
  redmineStatus: DISCONNECTED_REDMINE_STATUS,
  redmineStatusChecked: false,
  redmineStatusContextKey: null,

  checkRedmineConnection: async () => {
    const contextKey = getProviderRuntimeContextKey(get().settings)
    const generation = (statusReadGeneration += 1)
    if (get().redmineStatusContextKey !== contextKey) {
      set({ redmineStatusChecked: false })
    }
    let status: RedmineConnectionStatus
    try {
      status = await redmineStatus(get().settings)
    } catch (error) {
      console.warn('[redmine] status read failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      status = DISCONNECTED_REDMINE_STATUS
    }
    if (
      generation !== statusReadGeneration ||
      getProviderRuntimeContextKey(get().settings) !== contextKey
    ) {
      return
    }
    set({
      redmineStatus: status,
      redmineStatusChecked: true,
      redmineStatusContextKey: contextKey
    })
  },

  connectRedmine: async (args) => {
    try {
      const result = await redmineConnect(get().settings, args)
      if (result.ok) {
        await get().checkRedmineConnection()
      }
      return result
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  },

  testRedmineConnection: async () => {
    try {
      const result = await redmineTestConnection(get().settings)
      await get().checkRedmineConnection()
      return result
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'Test failed' }
    }
  },

  disconnectRedmine: async () => {
    await redmineDisconnect(get().settings)
    await get().checkRedmineConnection()
  }
})

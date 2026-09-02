// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import type { RedmineIssue } from '../../../../shared/redmine-types'

const openModal = vi.fn()
const checkRedmineConnection = vi.fn(() => Promise.resolve())
const storeState = {
  openModal,
  checkRedmineConnection,
  settings: { activeRuntimeEnvironmentId: null },
  redmineStatusChecked: false,
  redmineStatusContextKey: null as string | null,
  redmineStatus: { connected: true, connection: { baseUrl: 'https://redmine.example.com' } }
}

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: typeof storeState) => unknown) => selector(storeState),
    { getState: () => storeState }
  )
}))

// Why: the real panel fetches Redmine over IPC; capture its props instead.
const panelProps = vi.fn()
vi.mock('@/components/task-page-redmine-panel', () => ({
  TaskPageRedminePanel: (props: Record<string, unknown>) => {
    panelProps(props)
    return null
  }
}))

const connectDialogProps = vi.fn()
vi.mock('@/components/redmine-connect-dialog', () => ({
  RedmineConnectDialog: (props: Record<string, unknown>) => {
    connectDialogProps(props)
    return null
  }
}))

import { FloatingWorkspaceTasksView } from './FloatingWorkspaceTasksView'

describe('FloatingWorkspaceTasksView', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    openModal.mockClear()
    checkRedmineConnection.mockClear()
    storeState.redmineStatusChecked = false
    storeState.redmineStatusContextKey = null
    panelProps.mockClear()
    connectDialogProps.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  type CapturedPanelProps = {
    onConnectRequest: () => void
    onHideProvider: () => void
    onStartWorkspace: (issue: RedmineIssue) => void
    sourceContext: unknown
  }

  function lastPanelProps(): CapturedPanelProps {
    return panelProps.mock.calls.at(-1)![0] as CapturedPanelProps
  }

  function lastConnectDialogProps(): { open: boolean } {
    return connectDialogProps.mock.calls.at(-1)![0] as { open: boolean }
  }

  it('routes Start workspace to the main-window composer modal with the linked Redmine issue', () => {
    act(() => {
      root.render(<FloatingWorkspaceTasksView onClose={() => {}} />)
    })

    act(() => {
      lastPanelProps().onStartWorkspace({
        id: 5969,
        subject: 'Fix login error',
        url: 'https://redmine.example.com/issues/5969',
        doneRatio: 0
      } as RedmineIssue)
    })

    expect(openModal).toHaveBeenCalledTimes(1)
    const [modal, payload] = openModal.mock.calls[0]
    expect(modal).toBe('new-workspace-composer')
    expect(payload.linkedWorkItem).toMatchObject({
      provider: 'redmine',
      type: 'issue',
      number: 5969,
      title: 'Fix login error'
    })
    expect(payload.prefilledName).toBe('5969-fix-login-error')
    // Why: the workspace must be created in the main window, never inside the
    // floating worktree, so no floating worktree id may leak into the payload.
    expect(JSON.stringify(payload)).not.toContain('global-floating-terminal')
  })

  it('passes a Redmine task source context carrying the connected base URL', () => {
    act(() => {
      root.render(<FloatingWorkspaceTasksView onClose={() => {}} />)
    })

    expect(lastPanelProps().sourceContext).toMatchObject({
      provider: 'redmine',
      providerIdentity: { provider: 'redmine', baseUrl: 'https://redmine.example.com' }
    })
  })

  it('opens the connect dialog when the panel asks to connect', () => {
    act(() => {
      root.render(<FloatingWorkspaceTasksView onClose={() => {}} />)
    })
    expect(lastConnectDialogProps().open).toBe(false)

    act(() => {
      lastPanelProps().onConnectRequest()
    })

    expect(lastConnectDialogProps().open).toBe(true)
  })

  it('closes the floating view instead of mutating global task-source settings when asked to hide Redmine', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(<FloatingWorkspaceTasksView onClose={onClose} />)
    })

    act(() => {
      lastPanelProps().onHideProvider()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('checks the Redmine connection on mount so an unchecked status does not spin forever', () => {
    act(() => {
      root.render(<FloatingWorkspaceTasksView onClose={() => {}} />)
    })

    expect(checkRedmineConnection).toHaveBeenCalledTimes(1)
  })

  it('does not re-check a Redmine status that is already settled for this runtime', () => {
    storeState.redmineStatusChecked = true
    storeState.redmineStatusContextKey = getProviderRuntimeContextKey(storeState.settings)

    act(() => {
      root.render(<FloatingWorkspaceTasksView onClose={() => {}} />)
    })

    expect(checkRedmineConnection).not.toHaveBeenCalled()
  })
})

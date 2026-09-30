// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const openHttpLink = vi.fn()

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ activeWorktreeId: 'wt-1', repos: [], settings: {} })
}))
vi.mock('@/lib/http-link-routing', () => ({
  openHttpLink: (...args: unknown[]) => openHttpLink(...args)
}))

import { TooltipProvider } from '@/components/ui/tooltip'
import { TaskPageRedmineIssueList } from './task-page-redmine-issue-list'
import type { RedmineIssue } from '../../../shared/redmine-types'

const issue: RedmineIssue = {
  id: 42,
  subject: 'Fix login',
  description: '<p><strong>Steps</strong> to reproduce</p>',
  doneRatio: 30,
  project: { id: 1, name: 'Web' },
  status: { id: 2, name: 'In Progress' },
  assignedTo: { id: 3, name: 'Kim' },
  url: 'https://redmine.example/issues/42'
}

function renderList(): { onStartWorkspace: ReturnType<typeof vi.fn> } {
  const onStartWorkspace = vi.fn()
  render(
    <TooltipProvider>
      <TaskPageRedmineIssueList
        issues={[issue]}
        projects={[]}
        onStartWorkspace={onStartWorkspace}
      />
    </TooltipProvider>
  )
  return { onStartWorkspace }
}

describe('TaskPageRedmineIssueList', () => {
  afterEach(() => {
    cleanup()
    openHttpLink.mockReset()
  })

  it('opens the detail sheet when a row is clicked', async () => {
    renderList()
    await userEvent.click(screen.getByRole('button', { name: 'Open details for #42' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Steps').tagName).toBe('STRONG')
  })

  it('opens the detail sheet with Enter on a focused row', async () => {
    renderList()
    screen.getByRole('button', { name: 'Open details for #42' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('runs row actions without opening the sheet', async () => {
    const { onStartWorkspace } = renderList()
    await userEvent.click(screen.getByRole('button', { name: 'Start workspace from #42' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open #42 in Redmine' }))
    expect(onStartWorkspace).toHaveBeenCalledWith(issue)
    expect(openHttpLink).toHaveBeenCalledWith(issue.url, expect.anything())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('starts a workspace from the sheet and closes it', async () => {
    const { onStartWorkspace } = renderList()
    await userEvent.click(screen.getByRole('button', { name: 'Open details for #42' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start workspace' }))
    expect(onStartWorkspace).toHaveBeenCalledWith(issue)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

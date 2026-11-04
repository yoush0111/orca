// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RedmineAgentSkillRow } from './redmine-agent-skill-row'

function stubApi(status: string, installResult: string | Error): ReturnType<typeof vi.fn> {
  const installAgentSkill =
    installResult instanceof Error
      ? vi.fn().mockRejectedValue(installResult)
      : vi.fn().mockResolvedValue(installResult)
  Object.assign(window, {
    api: { redmine: { agentSkillStatus: vi.fn().mockResolvedValue(status), installAgentSkill } }
  })
  return installAgentSkill
}

describe('RedmineAgentSkillRow', () => {
  afterEach(cleanup)

  it('installs a missing skill and shows it as installed', async () => {
    const install = stubApi('missing', 'installed')
    render(<RedmineAgentSkillRow connected />)

    await userEvent.click(await screen.findByRole('button', { name: 'Install' }))

    expect(install).toHaveBeenCalled()
    expect(await screen.findByText('Installed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Install' })).toBeDisabled()
  })

  it('offers an update for an outdated skill and shows install errors', async () => {
    stubApi('outdated', new Error('EACCES'))
    render(<RedmineAgentSkillRow connected={false} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Update' }))

    expect(await screen.findByText('EACCES')).toBeInTheDocument()
    expect(screen.getByText('The skill works after Redmine is connected.')).toBeInTheDocument()
  })
})

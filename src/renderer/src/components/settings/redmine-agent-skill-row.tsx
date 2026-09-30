import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { RedmineAgentSkillStatus } from '../../../../shared/redmine-types'

function statusLabel(status: RedmineAgentSkillStatus | null): string {
  if (status === 'installed') {
    return translate('auto.components.settings.redmine.agent.skill.installed', 'Installed')
  }
  if (status === 'outdated') {
    return translate('auto.components.settings.redmine.agent.skill.outdated', 'Update available')
  }
  return translate('auto.components.settings.redmine.agent.skill.missing', 'Not installed')
}

// Why: installs for the local Claude only, so it bypasses the runtime-routed Redmine client.
export function RedmineAgentSkillRow({ connected }: { connected: boolean }): React.JSX.Element {
  const [status, setStatus] = useState<RedmineAgentSkillStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.redmine.agentSkillStatus().then(setStatus)
  }, [])

  const install = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await window.api.redmine.installAgentSkill())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {translate(
              'auto.components.settings.redmine.agent.skill.title',
              'Claude Code skill (orca-redmine)'
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {translate(
              'auto.components.settings.redmine.agent.skill.description',
              'Lets Claude read Redmine issues and post approved decision notes through Orca. Installs into ~/.claude/skills on this computer.'
            )}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">{statusLabel(status)}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || status === null || status === 'installed'}
          onClick={() => void install()}
        >
          {status === 'outdated'
            ? translate('auto.components.settings.redmine.agent.skill.update', 'Update')
            : translate('auto.components.settings.redmine.agent.skill.install', 'Install')}
        </Button>
      </div>
      {connected ? null : (
        <p className="text-[11px] text-muted-foreground/70">
          {translate(
            'auto.components.settings.redmine.agent.skill.needsConnection',
            'The skill works after Redmine is connected.'
          )}
        </p>
      )}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}

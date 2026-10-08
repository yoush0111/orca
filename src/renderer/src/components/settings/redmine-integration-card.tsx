import { useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Unlink } from 'lucide-react'
import { RedmineConnectDialog } from '@/components/redmine-connect-dialog'
import { RedmineIcon } from '@/components/icons/RedmineIcon'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import {
  getProviderRuntimeContextKey,
  hasRemoteProviderRuntime
} from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { useIntegrationSubordinateRowClass } from './integration-card-presentation'
import { getProviderAccountScope } from './provider-account-scope'
import { ProviderHostScopeControl } from './ProviderHostScopeControl'
import { REDMINE_INTEGRATION_SECTION_ID } from './task-provider-integration-section-ids'
import { NumberField, SettingsSwitchRow } from './SettingsFormControls'
import { RedmineProjectRepoMapping } from './redmine-project-repo-mapping'
import { RedmineAgentSkillRow } from './redmine-agent-skill-row'
import { translate } from '@/i18n/i18n'

type VerificationResult = { state: 'ok' | 'error'; error?: string }

export function RedmineIntegrationCard(): React.JSX.Element {
  const redmineStatus = useAppStore((s) => s.redmineStatus)
  const redmineStatusChecked = useAppStore((s) => s.redmineStatusChecked)
  const redmineStatusContextKey = useAppStore((s) => s.redmineStatusContextKey)
  const checkRedmineConnection = useAppStore((s) => s.checkRedmineConnection)
  const disconnectRedmine = useAppStore((s) => s.disconnectRedmine)
  const testRedmineConnection = useAppStore((s) => s.testRedmineConnection)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const floatingTerminalEnabled = useAppStore((s) => s.settings?.floatingTerminalEnabled === true)
  const mountedRef = useMountedRef()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<VerificationResult | null>(null)

  const contextMatches = redmineStatusContextKey === getProviderRuntimeContextKey(settings)
  const checking = !contextMatches || !redmineStatusChecked
  const connected = contextMatches && redmineStatus.connected
  const connection = redmineStatus.connection
  const accountScope = getProviderAccountScope(settings)
  const credentialCopy = hasRemoteProviderRuntime(settings)
    ? translate(
        'auto.components.settings.redmine.integration.card.credentialRemote',
        'Connect a Redmine instance with its REST API key. The key is sent to the selected remote runtime and stored there with runtime-supported encryption.'
      )
    : translate(
        'auto.components.settings.redmine.integration.card.credentialLocal',
        'Connect a Redmine instance with its REST API key. The key is stored locally and encrypted when local runtime storage supports it.'
      )
  const subordinateRowClass = useIntegrationSubordinateRowClass('flex items-center gap-3')
  const accountScopeRowClass = useIntegrationSubordinateRowClass('text-xs')

  const handleDisconnect = async (): Promise<void> => {
    await disconnectRedmine()
    if (mountedRef.current) {
      setTestResult(null)
    }
  }

  // Why: explicit user-triggered verification. This is the only settings path
  // that decrypts the stored key, avoiding surprise keychain prompts.
  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    const result = await testRedmineConnection()
    if (!mountedRef.current) {
      return
    }
    setTestResult(result.ok ? { state: 'ok' } : { state: 'error', error: result.error })
    setTesting(false)
  }

  return (
    <IntegrationCardShell
      settingsSectionId={REDMINE_INTEGRATION_SECTION_ID}
      icon={<RedmineIcon className="size-5" />}
      name="Redmine"
      description={
        connected
          ? (connection?.baseUrl ??
            translate(
              'auto.components.settings.redmine.integration.card.connectedFallback',
              'Redmine instance connected'
            ))
          : checking
            ? translate(
                'auto.components.settings.redmine.integration.card.checking',
                'Checking Redmine access before showing setup actions.'
              )
            : translate(
                'auto.components.settings.redmine.integration.card.pitch',
                'Browse Redmine issues and start workspaces from them.'
              )
      }
      checking={checking}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={
        connected
          ? translate(
              'auto.components.settings.redmine.integration.card.statusConnected',
              'Connected'
            )
          : translate(
              'auto.components.settings.redmine.integration.card.statusNotConnected',
              'Not connected'
            )
      }
      actions={
        !checking ? (
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {connected
              ? translate(
                  'auto.components.settings.redmine.integration.card.replace',
                  'Replace connection'
                )
              : translate(
                  'auto.components.settings.redmine.integration.card.connect',
                  'Connect Redmine'
                )}
          </Button>
        ) : null
      }
    >
      <IntegrationCardDetails>
        <ProviderHostScopeControl
          labelPrefix={translate(
            'auto.components.settings.task.tracker.integration.cards.account_scope_prefix',
            'Account scope'
          )}
          scope={accountScope}
          className={accountScopeRowClass}
        />
        {redmineStatus.credentialError ? (
          <p className="text-xs text-destructive">{redmineStatus.credentialError}</p>
        ) : null}
        {connected && connection ? (
          <div className="space-y-2">
            <div className={subordinateRowClass}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {connection.viewer.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {connection.baseUrl}
                  {connection.viewer.email ? ` · ${connection.viewer.email}` : ''}
                </p>
              </div>
              {testResult?.state === 'ok' ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-status-success">
                  <CheckCircle2 className="size-3.5" />
                  {translate(
                    'auto.components.settings.task.tracker.integration.cards.a2c0015fb8',
                    'Verified'
                  )}
                </span>
              ) : null}
              {testResult?.state === 'error' ? (
                <span className="flex min-w-0 max-w-[220px] shrink items-center gap-1 truncate text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span className="truncate">{testResult.error}</span>
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleTest()}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <LoaderCircle className="size-3.5 mr-1.5 animate-spin" />
                    {translate(
                      'auto.components.settings.task.tracker.integration.cards.3e7c10d286',
                      'Testing...'
                    )}
                  </>
                ) : (
                  translate(
                    'auto.components.settings.task.tracker.integration.cards.c24e56c532',
                    'Test'
                  )
                )}
              </Button>
              <button
                onClick={() => void handleDisconnect()}
                aria-label={translate(
                  'auto.components.settings.task.tracker.integration.cards.dd3529015d',
                  'Disconnect {{value0}}',
                  { value0: connection.baseUrl }
                )}
                className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
              >
                <Unlink className="size-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              {translate(
                'auto.components.settings.redmine.integration.card.singleConnection',
                'One Redmine instance is connected per runtime. Connecting again replaces the stored key.'
              )}
            </p>
          </div>
        ) : !checking ? (
          <>
            <p className="text-xs text-muted-foreground">{credentialCopy}</p>
            <Button variant="ghost" size="sm" onClick={() => void checkRedmineConnection()}>
              {translate(
                'auto.components.settings.task.tracker.integration.cards.c90f2ef419',
                'Re-check'
              )}
            </Button>
          </>
        ) : null}
        <RedmineAgentSkillRow connected={connected} />
        {/* Outside the connected branch: the routing preference is worth finding
            before a connection exists, and it survives a disconnect. */}
        <SettingsSwitchRow
          label={translate(
            'auto.components.settings.redmine.integration.card.floatingLabel',
            'Open issue links in the Floating Workspace'
          )}
          description={
            floatingTerminalEnabled
              ? translate(
                  'auto.components.settings.redmine.integration.card.floatingDescription',
                  'Redmine issue links open as a browser tab in the Floating Workspace instead of the active worktree.'
                )
              : translate(
                  'auto.components.settings.redmine.integration.card.floatingDisabled',
                  'Enable the Floating Workspace (Settings → Floating Workspace) for this to take effect.'
                )
          }
          checked={settings?.redmineLinksOpenInFloatingWorkspace !== false}
          disabled={!floatingTerminalEnabled}
          onChange={() =>
            updateSettings({
              redmineLinksOpenInFloatingWorkspace:
                settings?.redmineLinksOpenInFloatingWorkspace === false
            })
          }
        />
        {connected ? (
          <NumberField
            label={translate(
              'auto.components.settings.redmine.integration.card.developerFieldLabel',
              'Developer custom field ID'
            )}
            description={translate(
              'auto.components.settings.redmine.integration.card.developerFieldDescription',
              'Weekly reports also include issues where this user field names you. Leave empty to use only the assignee.'
            )}
            value={settings?.redmineDeveloperFieldId}
            min={1}
            integer
            placeholder="31"
            onChange={(value) => void updateSettings({ redmineDeveloperFieldId: value })}
            onClear={() => void updateSettings({ redmineDeveloperFieldId: undefined })}
          />
        ) : null}
        {connected ? <RedmineProjectRepoMapping /> : null}
      </IntegrationCardDetails>

      <RedmineConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnected={() => setTestResult(null)}
        overlayClassName="z-[110]"
        contentClassName="z-[120]"
      />
    </IntegrationCardShell>
  )
}

import { useId, useLayoutEffect, useState } from 'react'
import { LoaderCircle, Lock } from 'lucide-react'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { hasRemoteProviderRuntime } from '@/lib/provider-runtime-context'
import { translate } from '@/i18n/i18n'

type RedmineConnectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: () => void
  overlayClassName?: string
  contentClassName?: string
}

type ConnectState = 'idle' | 'connecting' | 'error'

export function RedmineConnectDialog({
  open,
  onOpenChange,
  onConnected,
  overlayClassName,
  contentClassName
}: RedmineConnectDialogProps): React.JSX.Element {
  const connectRedmine = useAppStore((s) => s.connectRedmine)
  const settings = useAppStore((s) => s.settings)
  const mountedRef = useMountedRef()
  const baseUrlId = useId()
  const apiKeyId = useId()
  const errorId = useId()

  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [connectError, setConnectError] = useState<string | null>(null)

  // Clear before paint so a previously-typed key never renders for a frame.
  useLayoutEffect(() => {
    if (!open) {
      return
    }
    setBaseUrl('')
    setApiKey('')
    setConnectState('idle')
    setConnectError(null)
  }, [open])

  const canSubmit =
    Boolean(baseUrl.trim()) && Boolean(apiKey.trim()) && connectState !== 'connecting'
  const credentialStorageCopy = hasRemoteProviderRuntime(settings)
    ? translate(
        'auto.components.redmine.connect.dialog.credentialRemote',
        'Your API key is sent to the selected remote runtime and stored there with runtime-supported encryption.'
      )
    : translate(
        'auto.components.redmine.connect.dialog.credentialLocal',
        'Your API key is stored locally and encrypted when local runtime storage supports it.'
      )

  const clearErrorOnEdit = (): void => {
    if (connectState === 'error') {
      setConnectState('idle')
      setConnectError(null)
    }
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (connectState !== 'connecting') {
      onOpenChange(nextOpen)
    }
  }

  const handleConnect = async (): Promise<void> => {
    const trimmedBaseUrl = baseUrl.trim()
    const trimmedApiKey = apiKey.trim()
    if (!trimmedBaseUrl || !trimmedApiKey || connectState === 'connecting') {
      return
    }
    setConnectState('connecting')
    setConnectError(null)
    try {
      const result = await connectRedmine({ baseUrl: trimmedBaseUrl, apiKey: trimmedApiKey })
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setBaseUrl('')
        setApiKey('')
        setConnectState('idle')
        onOpenChange(false)
        onConnected?.()
        return
      }
      setConnectState('error')
      setConnectError(result.error)
    } catch (error) {
      if (mountedRef.current) {
        setConnectState('error')
        setConnectError(error instanceof Error ? error.message : 'Connection failed')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName={overlayClassName}
        className={cn('sm:max-w-md', contentClassName)}
      >
        <DialogHeader className="gap-3">
          <DialogTitle className="leading-tight">
            {translate('auto.components.redmine.connect.dialog.title', 'Connect Redmine')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.redmine.connect.dialog.description',
              'Use your Redmine base URL and the REST API key from your account page to browse issues.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void handleConnect()
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor={baseUrlId} className="text-xs">
                {translate('auto.components.redmine.connect.dialog.baseUrlLabel', 'Base URL')}
              </Label>
              <Input
                id={baseUrlId}
                placeholder={translate(
                  'auto.components.redmine.connect.dialog.baseUrlPlaceholder',
                  'https://redmine.example.com'
                )}
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value)
                  clearErrorOnEdit()
                }}
                disabled={connectState === 'connecting'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={apiKeyId} className="text-xs">
                {translate('auto.components.redmine.connect.dialog.apiKeyLabel', 'API key')}
              </Label>
              <Input
                id={apiKeyId}
                type="password"
                placeholder={translate(
                  'auto.components.redmine.connect.dialog.apiKeyPlaceholder',
                  'Redmine REST API key'
                )}
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value)
                  clearErrorOnEdit()
                }}
                disabled={connectState === 'connecting'}
                aria-invalid={connectState === 'error'}
                aria-describedby={connectState === 'error' ? errorId : undefined}
              />
            </div>
            {connectState === 'error' && connectError ? (
              <p id={errorId} className="text-xs text-destructive">
                {connectError}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.redmine.connect.dialog.apiKeyHint',
                'Find the key under My account, API access key. REST API access must be enabled in Redmine administration.'
              )}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <Lock className="size-3 shrink-0" />
              {credentialStorageCopy}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={connectState === 'connecting'}
            >
              {translate('auto.components.redmine.connect.dialog.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {connectState === 'connecting' ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {translate('auto.components.redmine.connect.dialog.verifying', 'Verifying…')}
                </>
              ) : (
                translate('auto.components.redmine.connect.dialog.connect', 'Connect')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

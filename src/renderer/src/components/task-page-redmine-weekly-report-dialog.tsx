import { useId, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'

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
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { redmineWeeklyReport, type RuntimeRedmineSettings } from '@/runtime/runtime-redmine-client'
import { useAppStore } from '@/store'
import {
  defaultWeeklyReportRange,
  isValidWeeklyReportRange,
  toWeeklyReportQuery,
  weeklyReportFileName,
  type WeeklyReportRange
} from './task-page-redmine-weekly-report-range'

type GeneratedReport = { markdown: string; issueCount: number; skippedIssueIds: number[] }

type TaskPageRedmineWeeklyReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  readSettings: RuntimeRedmineSettings
}

export function TaskPageRedmineWeeklyReportDialog({
  open,
  onOpenChange,
  readSettings
}: TaskPageRedmineWeeklyReportDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Content unmounts on close, so every open starts from today's range. */}
        <WeeklyReportBody readSettings={readSettings} />
      </DialogContent>
    </Dialog>
  )
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function ReportSummary({ report }: { report: GeneratedReport }): React.JSX.Element {
  return (
    <p className="text-xs text-muted-foreground">
      {translate(
        'auto.components.task.page.redmine.weekly.report.issueCount',
        '{{value0}} issues',
        {
          value0: report.issueCount
        }
      )}
      {report.skippedIssueIds.length > 0
        ? ` · ${translate('auto.components.task.page.redmine.weekly.report.skipped', 'Skipped {{value0}}', { value0: report.skippedIssueIds.map((id) => `#${id}`).join(', ') })}`
        : null}
    </p>
  )
}

function WeeklyReportBody({
  readSettings
}: {
  readSettings: RuntimeRedmineSettings
}): React.JSX.Element {
  const developerFieldId = useAppStore((s) => s.settings?.redmineDeveloperFieldId)
  const reportDir = useAppStore((s) => s.settings?.redmineWeeklyReportDir)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const fromId = useId()
  const toId = useId()

  const [range, setRange] = useState<WeeklyReportRange>(() => defaultWeeklyReportRange())
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<GeneratedReport | null>(null)

  const rangeValid = isValidWeeklyReportRange(range)
  const hasContent = Boolean(report?.markdown.trim())

  const generate = async (): Promise<void> => {
    setGenerating(true)
    setError(null)
    try {
      setReport(
        await redmineWeeklyReport(readSettings, toWeeklyReportQuery(range, developerFieldId))
      )
    } catch (generateError) {
      setError(
        errorMessage(
          generateError,
          translate(
            'auto.components.task.page.redmine.weekly.report.generateFailed',
            'Could not build the weekly report.'
          )
        )
      )
    } finally {
      setGenerating(false)
    }
  }

  const copy = async (): Promise<void> => {
    if (!report) {
      return
    }
    try {
      await window.api.ui.writeClipboardText(report.markdown)
      toast.success(
        translate('auto.components.task.page.redmine.weekly.report.copied', 'Copied Markdown')
      )
    } catch (copyError) {
      setError(
        errorMessage(
          copyError,
          translate(
            'auto.components.task.page.redmine.weekly.report.copyFailed',
            'Could not copy the report.'
          )
        )
      )
    }
  }

  const save = async (): Promise<void> => {
    if (!report) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await window.api.redmine.saveWeeklyReport({
        fileName: weeklyReportFileName(range),
        markdown: report.markdown,
        ...(reportDir ? { defaultDir: reportDir } : {})
      })
      if (result.ok) {
        void updateSettings({ redmineWeeklyReportDir: result.directory })
        toast.success(
          translate('auto.components.task.page.redmine.weekly.report.saved', 'Saved {{value0}}', {
            value0: result.filePath
          })
        )
      } else if (!result.canceled) {
        // Content stays in the dialog so it can still be copied out.
        setError(result.error)
      }
    } catch (saveError) {
      setError(
        errorMessage(
          saveError,
          translate(
            'auto.components.task.page.redmine.weekly.report.saveFailed',
            'Could not save the report.'
          )
        )
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate('auto.components.task.page.redmine.weekly.report.title', 'Weekly report')}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'auto.components.task.page.redmine.weekly.report.description',
            'Issues assigned to you that were updated in the selected period, grouped by project and tracker.'
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={fromId}>
            {translate('auto.components.task.page.redmine.weekly.report.from', 'Start date')}
          </Label>
          <Input
            id={fromId}
            type="date"
            className="w-40"
            value={range.from}
            onChange={(event) => setRange({ ...range, from: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={toId}>
            {translate('auto.components.task.page.redmine.weekly.report.to', 'End date')}
          </Label>
          <Input
            id={toId}
            type="date"
            className="w-40"
            value={range.to}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
          />
        </div>
        <Button variant="outline" onClick={() => setRange(defaultWeeklyReportRange())}>
          {translate('auto.components.task.page.redmine.weekly.report.last7Days', 'Last 7 days')}
        </Button>
        <Button disabled={!rangeValid || generating} onClick={() => void generate()}>
          {generating ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          {translate('auto.components.task.page.redmine.weekly.report.generate', 'Generate')}
        </Button>
      </div>
      {!rangeValid ? (
        <p className="text-xs text-destructive">
          {translate(
            'auto.components.task.page.redmine.weekly.report.invalidRange',
            'Choose a start date on or before the end date.'
          )}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {report === null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {generating
            ? translate(
                'auto.components.task.page.redmine.weekly.report.generating',
                'Building the report…'
              )
            : translate(
                'auto.components.task.page.redmine.weekly.report.hint',
                'Choose a period and select Generate.'
              )}
        </p>
      ) : report.issueCount === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {translate(
            'auto.components.task.page.redmine.weekly.report.empty',
            'No issues match the selected period.'
          )}
        </p>
      ) : (
        <>
          <Textarea
            variant="code"
            className="h-80 resize-none"
            value={report.markdown}
            onChange={(event) => setReport({ ...report, markdown: event.target.value })}
            aria-label={translate(
              'auto.components.task.page.redmine.weekly.report.preview',
              'Weekly report Markdown'
            )}
          />
          <ReportSummary report={report} />
        </>
      )}

      <DialogFooter>
        <Button variant="outline" disabled={!hasContent} onClick={() => void copy()}>
          {translate('auto.components.task.page.redmine.weekly.report.copy', 'Copy Markdown')}
        </Button>
        <Button disabled={!hasContent || saving} onClick={() => void save()}>
          {translate('auto.components.task.page.redmine.weekly.report.save', 'Save…')}
        </Button>
      </DialogFooter>
    </>
  )
}

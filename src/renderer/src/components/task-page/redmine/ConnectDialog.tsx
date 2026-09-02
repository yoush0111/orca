import type { TaskPageRedmineStateModel } from '../../use-task-page-redmine-state'
import { RedmineConnectDialog } from '@/components/redmine-connect-dialog'

export function TaskPageRedmineConnectDialog({
  model
}: {
  model: TaskPageRedmineStateModel
}): React.JSX.Element {
  const { redmineConnectOpen, setRedmineConnectOpen } = model
  return <RedmineConnectDialog open={redmineConnectOpen} onOpenChange={setRedmineConnectOpen} />
}

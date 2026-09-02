import type { TaskPageRedmineStateModel } from '../../use-task-page-redmine-state'
import { TaskPageRedminePanel } from '@/components/task-page-redmine-panel'

export function TaskPageRedmineContent({
  model
}: {
  model: TaskPageRedmineStateModel
}): React.JSX.Element {
  const {
    hideTaskSource,
    setRedmineConnectOpen,
    setRedmineProjects,
    handleUseRedmineItem,
    redmineTaskSourceContext
  } = model
  return (
    <TaskPageRedminePanel
      onConnectRequest={() => setRedmineConnectOpen(true)}
      onHideProvider={() => hideTaskSource('redmine', 'Redmine')}
      onStartWorkspace={handleUseRedmineItem}
      onProjectsLoaded={setRedmineProjects}
      sourceContext={redmineTaskSourceContext}
    />
  )
}

import { ipcRenderer } from 'electron'
import type { RedmineApi } from './redmine-api'

export const redmineApi: RedmineApi = {
  connect: (args) => ipcRenderer.invoke('redmine:connect', args),
  disconnect: () => ipcRenderer.invoke('redmine:disconnect'),
  status: () => ipcRenderer.invoke('redmine:status'),
  testConnection: () => ipcRenderer.invoke('redmine:testConnection'),
  listIssues: (args) => ipcRenderer.invoke('redmine:listIssues', args),
  listProjects: () => ipcRenderer.invoke('redmine:listProjects'),
  listStatuses: () => ipcRenderer.invoke('redmine:listStatuses')
}

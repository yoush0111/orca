import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import { getLinearLinkedWorkItemBranchName } from '@/lib/linear-linked-work-item'

/**
 * The canonical git ref a linked work item brings with it, bypassing the
 * configured branch prefix. Linear supplies its own `branchName`; Redmine
 * derives `feature/<id>-<subject-slug>`. Every other provider has no canonical
 * ref, so the workspace name drives the branch as usual.
 */
export function getLinkedWorkItemBranchNameOverride(
  item: LinkedWorkItemSummary | null | undefined
): string | undefined {
  if (item?.provider === 'redmine') {
    return item.redmineBranchName?.trim() || undefined
  }
  return getLinearLinkedWorkItemBranchName(item)
}

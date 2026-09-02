import { describe, expect, it } from 'vitest'
import { resolveRedmineIssueOpenOptions } from './task-page-redmine-link-routing'

const plainClick = { metaKey: false, ctrlKey: false, shiftKey: false }

describe('resolveRedmineIssueOpenOptions', () => {
  it('leaves the destination to the Link Routing setting on a plain click', () => {
    expect(resolveRedmineIssueOpenOptions(plainClick, false, 'wt-1')).toEqual({
      worktreeId: 'wt-1',
      sourceOwner: { kind: 'local' }
    })
  })

  it('flags the escape hatch on Shift+Cmd click on mac', () => {
    expect(
      resolveRedmineIssueOpenOptions(
        { metaKey: true, ctrlKey: false, shiftKey: true },
        true,
        'wt-1'
      )
    ).toEqual({ worktreeId: 'wt-1', sourceOwner: { kind: 'local' }, modifierHeld: true })
  })

  it('flags the escape hatch on Shift+Ctrl click off mac', () => {
    expect(
      resolveRedmineIssueOpenOptions(
        { metaKey: false, ctrlKey: true, shiftKey: true },
        false,
        'wt-1'
      )
    ).toEqual({ worktreeId: 'wt-1', sourceOwner: { kind: 'local' }, modifierHeld: true })
  })

  it('forces the in-app tab when the floating workspace is the target', () => {
    expect(resolveRedmineIssueOpenOptions(plainClick, false, 'floating', true)).toEqual({
      worktreeId: 'floating',
      sourceOwner: { kind: 'local' },
      forceInApp: true
    })
  })

  it('keeps the escape hatch usable while forcing the in-app tab', () => {
    expect(
      resolveRedmineIssueOpenOptions(
        { metaKey: false, ctrlKey: true, shiftKey: true },
        false,
        'floating',
        true
      )
    ).toEqual({
      worktreeId: 'floating',
      sourceOwner: { kind: 'local' },
      forceInApp: true,
      modifierHeld: true
    })
  })

  it('does not treat the other platform modifier as the escape hatch', () => {
    expect(
      resolveRedmineIssueOpenOptions({ metaKey: true, ctrlKey: false, shiftKey: true }, false, null)
    ).toEqual({ worktreeId: null, sourceOwner: { kind: 'local' } })
  })
})

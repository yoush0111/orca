import { describe, expect, it } from 'vitest'
import { weeklyReportMarkdownToHtml } from './redmine-weekly-report-html'

describe('weeklyReportMarkdownToHtml', () => {
  it('turns the report into Slack-pasteable nested lists with links', () => {
    const markdown = [
      '**[케어포미]**',
      '',
      '*신규기능*',
      '- 복약 <알림> ([#5969](https://redmine.example.com/issues/5969)) (26.10.06 50%)',
      '\t- API 반영',
      '\t- QA 예정',
      '- 탈퇴 ([#5901](https://redmine.example.com/issues/5901)) (26.10.03 80%)',
      ''
    ].join('\n')
    expect(weeklyReportMarkdownToHtml(markdown)).toBe(
      '<p><b>[케어포미]</b></p><p><i>신규기능</i></p>' +
        '<ul><li>복약 &lt;알림&gt; (<a href="https://redmine.example.com/issues/5969">#5969</a>) (26.10.06 50%)' +
        '<ul><li>API 반영</li><li>QA 예정</li></ul></li>' +
        '<li>탈퇴 (<a href="https://redmine.example.com/issues/5901">#5901</a>) (26.10.03 80%)</li></ul>'
    )
  })

  it('does not turn non-http links into anchors', () => {
    expect(weeklyReportMarkdownToHtml('- [x](javascript:alert(1))')).not.toContain('<a')
  })
})

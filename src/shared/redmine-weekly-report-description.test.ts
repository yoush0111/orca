import { describe, expect, it } from 'vitest'
import { extractWeeklyReportDescription } from './redmine-weekly-report-description'

// Trimmed from Redmine #6536 (CKEditor HTML from the in-house template).
const ISSUE_6536 = `<h3>▶ 요건</h3>
<p><b>요청 내용:</b></p>
<ul>
	<li>병원 의뢰 내역 툴바에 '의뢰서 출력' 버튼 추가 (대기중·의뢰완료 탭, 체크 항목이 없으면 비활성)</li>
	<li>체크한 의뢰서를 한 번의 인쇄 작업으로 출력하고 의뢰서마다 페이지 분할</li>
	<li>브랜치 feature/hospital-bulk-form-print — 2ef9b68(feat), f1fa888(refactor)</li>
</ul>
<p><b>요청 사유:</b></p>
<p>병원 화면에서 체크한 여러 의뢰서를 한 번에 출력할 수 있도록 일괄 인쇄 기능 필요</p>
<h3>▶ 공수/일정</h3>
<table><tbody><tr><th>순번</th><th colspan="2">업무</th><th>공수<br />(시간)</th></tr>
<tr><td>1</td><td rowspan="2">분석</td><td>요건 분석</td><td>20m</td></tr></tbody></table>
<h3>▶ 오류</h3>
<ul><li>단계: 관리자(관리자 테스트), CS(CS&nbsp;테스트)</li></ul>
<table><tbody>
<tr><th>번호</th><th>심각도</th><th>단계</th><th>내용</th><th>등록일</th><th>처리<br />
여부</th><th>처리결과</th></tr>
<tr><td>1</td><td>상</td><td>관리자</td><td>위젯(WebView2) 일괄 출력 시 2페이지 이후 백지 출력</td><td>2026-10-26</td><td>완료</td><td>인쇄 시 의뢰서 모달 backdrop-filter 해제 (print:backdrop-filter-none)</td></tr>
<tr><td>2</td><td>중</td><td>관리자</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
</tbody></table>
<h3>▶ 개선/검토</h3>
<table><tbody>
<tr><th>번호</th><th>유형</th><th>단계</th><th>내용</th><th>처리결과</th></tr>
<tr><td>1</td><td>개선</td><td>관리자</td><td>출력 버튼 &amp; 단축키</td><td>&nbsp;</td></tr>
<tr><td>2</td><td>검토</td><td>관리자</td><td>&nbsp;</td><td>&nbsp;</td></tr>
</tbody></table>`

describe('extractWeeklyReportDescription', () => {
  it('reads request items, filled 오류/개선 rows, and commit hints from the template', () => {
    expect(extractWeeklyReportDescription(ISSUE_6536)).toEqual({
      lines: [
        "병원 의뢰 내역 툴바에 '의뢰서 출력' 버튼 추가 (대기중·의뢰완료 탭, 체크 항목이 없으면 비활성)",
        '체크한 의뢰서를 한 번의 인쇄 작업으로 출력하고 의뢰서마다 페이지 분할',
        '이슈: 위젯(WebView2) 일괄 출력 시 2페이지 이후 백지 출력 → 인쇄 시 의뢰서 모달 backdrop-filter 해제 (print:backdrop-filter-none)',
        '개선: 출력 버튼 & 단축키'
      ],
      hashes: ['2ef9b68', 'f1fa888'],
      branches: ['feature/hospital-bulk-form-print']
    })
  })

  it('adds nothing when the description does not follow the template', () => {
    expect(extractWeeklyReportDescription('<p>그냥 메모 abc1234 정리</p>').lines).toEqual([])
  })
})

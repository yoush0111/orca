#!/usr/bin/env bash
# 포크 Orca 사내 배포본(macOS)을 빌드해 Windows 릴리즈와 같은 태그에 올린다.
#
# macOS에서만 동작한다 — electron-builder는 mac 타깃을 크로스 빌드하지 못한다.
#
#   ./config/scripts/release-fork-mac.sh 1.0.7-personal
#
# Windows 쪽(D:\orca\release-orca.ps1)이 먼저 태그를 만들었으면 그 릴리즈에 자산만 얹고,
# 없으면 새로 만든다. latest.yml(win)과 latest-mac.yml이 같은 릴리즈에 있어야
# 두 플랫폼의 업데이트 체크(releases/latest/download/...)가 동시에 성립한다.
set -euo pipefail

VERSION="${1:-}"
FORK_OWNER="${ORCA_FORK_OWNER:-yoush0111}"
RELEASE_REPO="${ORCA_RELEASE_REPO:-orca-releases}"
ARCH_ARGS=("--x64" "--arm64")

if [[ -z "$VERSION" ]]; then
  echo "사용법: $0 <버전>   예: $0 1.0.7-personal" >&2
  exit 1
fi
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS에서만 실행할 수 있다 (electron-builder는 mac 타깃 크로스 빌드 불가)." >&2
  exit 1
fi
# Intel Mac 팀원이 없으면 ORCA_MAC_ARCH=arm64 로 빌드 시간을 절반으로 줄인다.
if [[ "${ORCA_MAC_ARCH:-both}" != "both" ]]; then
  ARCH_ARGS=("--${ORCA_MAC_ARCH}")
fi

cd "$(dirname "$0")/../.."

echo "== 1/5 Orca 종료 (파일 락 해제) =="
osascript -e 'quit app "Orca"' 2>/dev/null || true
pkill -f orca-terminal-daemon 2>/dev/null || true
sleep 3

echo "== 2/5 이전 빌드 산출물 삭제 =="
# Why: electron-builder는 출력 폴더만 번들에서 자동 제외한다. 남은 옛 dist/는
# 제외 대상이 아니라 그대로 app.asar에 딸려 들어간다.
rm -rf dist dist-release

echo "== 3/5 빌드 =="
export ORCA_FORK_PUBLISH_OWNER="$FORK_OWNER"   # 업데이트 피드를 포크로
export ORCA_FORK_PUBLISH_REPO="$RELEASE_REPO"  # 소스(orca)는 private, 릴리즈는 분리
export ORCA_LOCAL_BUILD_VERSION="$VERSION"     # package.json은 건드리지 않음
export ORCA_BUILD_COMMIT="$(git rev-parse --short=12 HEAD)"

pnpm run build:desktop
pnpm run build:computer-macos
pnpm run build:keyboard-layout-macos
pnpm run build:notification-status-macos
pnpm run ensure:electron-runtime
pnpm exec electron-builder --config config/electron-builder.config.cjs --mac "${ARCH_ARGS[@]}" --publish never

echo "== 4/5 산출물 검증 =="
# Why: mac은 app-update.yml이 Contents/Resources 아래에 박힌다 (win-unpacked/resources 아님).
FEED="$(find dist -name app-update.yml -path '*Orca.app/Contents/Resources/*' | head -1)"
[[ -n "$FEED" ]] || { echo "app-update.yml을 찾지 못했다 — 패키징이 실패했는지 확인할 것." >&2; exit 1; }
grep -q "owner: *$FORK_OWNER" "$FEED" || { echo "업데이트 피드가 $FORK_OWNER 가 아니다. 공식 Orca로 덮어써진다.:"; cat "$FEED"; exit 1; }
grep -q "repo: *$RELEASE_REPO" "$FEED" || { echo "업데이트 피드가 $RELEASE_REPO 가 아니다 (소스 repo는 private).:"; cat "$FEED"; exit 1; }
[[ -f dist/latest-mac.yml ]] || { echo "latest-mac.yml이 없다 — zip 타깃이 빠지면 자동 업데이트가 성립하지 않는다." >&2; exit 1; }
echo "  피드 $FORK_OWNER/$RELEASE_REPO — OK"

echo "== 5/5 GitHub 릴리즈 업로드 =="
# blockmap은 차등 다운로드용이라 없으면 매번 전체를 받는다. 있으면 같이 올린다.
ASSETS=(dist/latest-mac.yml)
while IFS= read -r asset; do ASSETS+=("$asset"); done < <(find dist -maxdepth 1 \( -name '*.dmg' -o -name '*-mac.zip' -o -name '*.blockmap' \))

if gh release view "v$VERSION" --repo "$FORK_OWNER/$RELEASE_REPO" >/dev/null 2>&1; then
  gh release upload "v$VERSION" "${ASSETS[@]}" --repo "$FORK_OWNER/$RELEASE_REPO" --clobber
else
  gh release create "v$VERSION" "${ASSETS[@]}" \
    --repo "$FORK_OWNER/$RELEASE_REPO" \
    --title "Orca $VERSION (사내 빌드)" \
    --notes "upstream Orca + Redmine 작업 소스. 설치 후 자동 업데이트는 $FORK_OWNER/$RELEASE_REPO 릴리즈를 따른다."
fi
echo "완료. Mac 팀원은 dmg를 받아 설치한 뒤 최초 1회 격리 속성을 지운다:"
echo "  xattr -dr com.apple.quarantine /Applications/Orca.app"

#!/usr/bin/env bash

# file_list_with_content.sh
# 지정한 제외 조건을 적용해 파일 목록을 수집하고
# 각 파일 경로 + 내용까지 포함해 하나의 TXT 파일로 출력합니다.

set -euo pipefail

OUTPUT="file_contents_$(date +%Y%m%d%H%M%S).txt"
declare -a EXC_DIRS
declare -a EXC_EXTS

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)
      OUTPUT="$2"; shift 2 ;;
    -d|--dir)
      EXC_DIRS+=("$2"); shift 2 ;;
    -e|--ext)
      EXC_EXTS+=("${2#.}"); shift 2 ;;
    *)
      echo "알 수 없는 옵션: $1" >&2; exit 1 ;;
  esac
done

# find용 -prune 조건 구성 (*/경로 형태로 모든 하위 경로 걸러냄)
PRUNE_DIRS=()
for dir in "${EXC_DIRS[@]:-}"; do
  PRUNE_DIRS+=(-path "*/$dir" -prune -o)
done

PRUNE_EXTS=()
for ext in "${EXC_EXTS[@]:-}"; do
  PRUNE_EXTS+=(-name "*.$ext" -o)
done

# 출력 파일 비우기
> "$OUTPUT"

# 파일 찾고, 각 파일에 대해 제목 + 내용 기록
find . "${PRUNE_DIRS[@]}" -type f ! \( "${PRUNE_EXTS[@]}" -false \) \
| sed 's|^\./||' \
| while IFS= read -r filepath; do
  echo "# $filepath " >> "$OUTPUT"
  cat "$filepath" >> "$OUTPUT" 2>/dev/null || echo "[⚠️ 읽을 수 없음]" >> "$OUTPUT"
  echo -e "\n" >> "$OUTPUT"
done

echo "✅ 총 $(grep -c '^===== ' "$OUTPUT")개 파일을 '$OUTPUT' 에 기록했습니다."

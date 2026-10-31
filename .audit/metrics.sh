#!/usr/bin/env bash
# Emits one KEY=VALUE per line. Never fails; missing values emit -1.
set -uo pipefail
cd "$(dirname "$0")/../frontend" || exit 1
npx tsc -b --noEmit >/dev/null 2>&1; echo "TSC_EXIT=$?"
LINT_JSON=$(npx eslint . -f json 2>/dev/null || echo '[]')
echo "LINT_ERRORS=$(echo "$LINT_JSON"  | python3 -c "import json,sys;d=json.load(sys.stdin);print(sum(f['errorCount'] for f in d))" 2>/dev/null || echo -1)"
echo "LINT_WARNINGS=$(echo "$LINT_JSON"| python3 -c "import json,sys;d=json.load(sys.stdin);print(sum(f['warningCount'] for f in d))" 2>/dev/null || echo -1)"
npx vite build >/dev/null 2>&1; echo "BUILD_EXIT=$?"
echo "CSS_CRITICAL=$(stat -c%s dist/assets/index-*.css 2>/dev/null | head -1 || echo -1)"
echo "JS_ENTRY=$(stat -c%s dist/assets/index-*.js 2>/dev/null | head -1 || echo -1)"
nonpara() { grep -rn "$1" src --include=*.tsx --include=*.ts 2>/dev/null | grep -v '/paradox/'; }
echo "STYLE_BLOCKS=$(nonpara '<style>' | cut -d: -f1 | sort -u | wc -l)"
echo "ACTIONLOADING_GLOBAL=$(grep -rn 'actionLoading !== null' src/director 2>/dev/null | wc -l)"
echo "RAW_SEARCH=$(grep -rn 'type="search"' src/director 2>/dev/null | grep -v adminKit | wc -l)"
echo "DESKS_NO_TOOLBAR=$(for f in src/director/{AccountApprovals,AchievementReviews,CategoryManagement,ContentManager,DirectorManagement,FormResponses,HiringResponses,MemberDirectory,PostModeration,ProjectManager,TeamManagement,VolunteerApplications}.tsx; do grep -q 'DataToolbar' "$f" 2>/dev/null || echo x; done | wc -l)"
echo "QUEUE_NO_BULK=$(for f in src/director/{AccountApprovals,PostModeration,AchievementReviews,FormResponses,HiringResponses}.tsx; do grep -q 'useRowSelection' "$f" 2>/dev/null || echo x; done | wc -l)"
echo "DIRECTOR_MEDIA=$(grep -c '@media' src/styles/routes/director.css 2>/dev/null || echo -1)"
echo "CLICKABLE_DIV=$(nonpara 'onClick' | grep -c '<div\|<span')"
echo "IMG_NO_ALT=$(python3 - <<'PY'
import re,glob
n=0
for p in glob.glob('src/**/*.tsx',recursive=True):
    if '/paradox/' in p: continue
    for m in re.findall(r'<img\b[^>]*>', open(p).read(), re.S):
        if 'alt=' not in m: n+=1
print(n)
PY
)"
echo "ANY_TYPES=$(nonpara ': any' | wc -l)"
echo "TS_IGNORE=$(nonpara '@ts-ignore\|@ts-expect-error' | wc -l)"
echo "TODOS=$(nonpara 'TODO\|FIXME\|HACK\|XXX' | wc -l)"
echo "ROOT_MD=$(ls ../*.md 2>/dev/null | wc -l)"
echo "BACKEND_DIR=$([ -d ../backend ] && echo 1 || echo 0)"
echo "SUPABASE_CLIENTS=$(ls src/lib/supabase*.ts 2>/dev/null | wc -l)"

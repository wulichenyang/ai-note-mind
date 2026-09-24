#!/usr/bin/env bash
# ============================================================
# NoteMind 一键上线脚本（Vercel Hobby 免费计划）
# ------------------------------------------------------------
# 部署形态：
#   notemind       ← web/   Next.js 16 + Prisma（数据库在 Neon，文件在 Vercel Blob）
#   notemind-agent ← agent/ Python 3.12 FastAPI（分片 / 向量化 / RAG 对话）
#
# 用法：
#   export VERCEL_TOKEN=xxxxx        # https://vercel.com/account/tokens 创建
#   bash scripts/deploy-vercel.sh
#
# 环境变量全部从本地已填好的 web/.env.local 与 agent/.env 读取，
# 不需要手动复制粘贴密钥。可重复执行（幂等）。
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WEB_PROJECT="${WEB_PROJECT:-notemind}"
AGENT_PROJECT="${AGENT_PROJECT:-notemind-agent}"
REGION="${REGION:-sin1}" # 与 Neon 的 ap-southeast-1 同区，降低跨区延迟

# ---------- 0. 让 Vercel CLI 的配置/缓存全部落在仓库内 ----------
# 否则 CLI 会尝试写 ~/Library/Application Support/com.vercel.cli（受限环境会 EPERM）
export CI=1
export XDG_CONFIG_HOME="$ROOT/.vercel-home/config"
export XDG_DATA_HOME="$ROOT/.vercel-home/data"
export XDG_CACHE_HOME="$ROOT/.vercel-home/cache"
export npm_config_cache="$ROOT/.npm-cache"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_CACHE_HOME" "$npm_config_cache"

: "${VERCEL_TOKEN:?请先 export VERCEL_TOKEN=（在 https://vercel.com/account/tokens 创建）}"
export VERCEL_TOKEN

V="npx --yes vercel@latest"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ---------- 1. 读取本地真实密钥 ----------
WEB_ENV="$ROOT/web/.env.local"
AGENT_ENV="$ROOT/agent/.env"
[ -f "$WEB_ENV" ] || { echo "缺少 $WEB_ENV"; exit 1; }
[ -f "$AGENT_ENV" ] || { echo "缺少 $AGENT_ENV"; exit 1; }

read_env() { # read_env <文件> <变量名>
  local file="$1" key="$2" line
  line="$(grep -E "^${key}=" "$file" | tail -1 || true)"
  [ -n "$line" ] || { echo ""; return; }
  printf '%s' "${line#*=}" | sed -E 's/^"//; s/"$//'
}

DATABASE_URL_DIRECT="$(read_env "$WEB_ENV" DATABASE_URL)"
AUTH_SECRET="$(read_env "$WEB_ENV" AUTH_SECRET)"
ENCRYPTION_KEY="$(read_env "$WEB_ENV" ENCRYPTION_KEY)"
BLOB_READ_WRITE_TOKEN="$(read_env "$WEB_ENV" BLOB_READ_WRITE_TOKEN)"
AI_BASE_URL="$(read_env "$WEB_ENV" AI_BASE_URL)"
AI_MODEL="$(read_env "$WEB_ENV" AI_MODEL)"
AGENT_SERVICE_TOKEN="$(read_env "$WEB_ENV" AGENT_SERVICE_TOKEN)"

SILICONFLOW_API_KEY="$(read_env "$AGENT_ENV" SILICONFLOW_API_KEY)"
SILICONFLOW_BASE_URL="$(read_env "$AGENT_ENV" SILICONFLOW_BASE_URL)"
EMBEDDING_MODEL="$(read_env "$AGENT_ENV" EMBEDDING_MODEL)"
VISION_MODEL="$(read_env "$AGENT_ENV" VISION_MODEL)"
AGENT_AI_BASE_URL="$(read_env "$AGENT_ENV" AI_BASE_URL)"
AGENT_AI_MODEL="$(read_env "$AGENT_ENV" AI_MODEL)"
SERVICE_TOKEN="$(read_env "$AGENT_ENV" SERVICE_TOKEN)"

for pair in "DATABASE_URL:$DATABASE_URL_DIRECT" "AUTH_SECRET:$AUTH_SECRET" \
            "ENCRYPTION_KEY:$ENCRYPTION_KEY" "BLOB_READ_WRITE_TOKEN:$BLOB_READ_WRITE_TOKEN" \
            "SERVICE_TOKEN:$SERVICE_TOKEN" "SILICONFLOW_API_KEY:$SILICONFLOW_API_KEY"; do
  [ -n "${pair#*:}" ] || { echo "环境变量为空：${pair%%:*}，请检查本地 .env"; exit 1; }
done

# web 端走 Neon 连接池（serverless 并发下避免打爆直连上限）；
# agent 端是短连接 psycopg，保持直连（PgBouncer 事务模式对预处理语句不友好）。
DATABASE_URL_POOLED="$(printf '%s' "$DATABASE_URL_DIRECT" | sed -E 's#@([^.@]+)\.#@\1-pooler.#')"
case "$DATABASE_URL_POOLED" in
  *\?*) DATABASE_URL_POOLED="${DATABASE_URL_POOLED}&pgbouncer=true&connect_timeout=15" ;;
  *)    DATABASE_URL_POOLED="${DATABASE_URL_POOLED}?sslmode=require&pgbouncer=true&connect_timeout=15" ;;
esac

# ---------- 2. 建项目（幂等：已存在则忽略） ----------
ensure_project() { # ensure_project <项目名>
  local name="$1" code
  code="$(curl -sS -o /tmp/vercel-project.json -w '%{http_code}' \
    -X POST "https://api.vercel.com/v11/projects" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\"}")"
  case "$code" in
    200|201) echo "   已创建项目 $name" ;;
    409)     echo "   项目 $name 已存在，跳过创建" ;;
    *)       echo "   创建 $name 失败（HTTP $code）：$(cat /tmp/vercel-project.json)"; exit 1 ;;
  esac
}

link_project() { # link_project <目录> <项目名>
  ( cd "$ROOT/$1" && $V link --yes --project "$2" --token "$VERCEL_TOKEN" >/dev/null 2>&1 )
  echo "   已关联 $1 → $2"
}

# 新建项目默认开启 Deployment Protection（Vercel Authentication），
# 会让 *.vercel.app 生产地址也要登录才能访问，外部（含 web BFF 调 agent）全部打不通。
# 必须关掉：web 是公开站点；agent 除 /health 外由 X-Service-Token 自行鉴权。
disable_protection() { # disable_protection <目录>
  local meta="$ROOT/$1/.vercel/project.json" org proj
  [ -f "$meta" ] || return 0
  org="$(node -e "process.stdout.write(require('$meta').orgId)")"
  proj="$(node -e "process.stdout.write(require('$meta').projectName)")"
  curl -sS --max-time 30 -X PATCH "https://api.vercel.com/v9/projects/$proj?teamId=$org" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"ssoProtection":null}' >/dev/null
  echo "   已关闭 $proj 的 Deployment Protection"
}

# 取项目的稳定生产别名（形如 https://xxx.vercel.app）。
# 注意：`vercel deploy` 输出的是带随机 hash 的一次性地址，
# 拿它当 AGENT_BASE_URL 会导致 web 永远调用"旧那次"的 agent，必须换成别名。
production_alias() { # production_alias <目录>
  local meta="$ROOT/$1/.vercel/project.json" org proj
  [ -f "$meta" ] || return 0
  org="$(node -e "process.stdout.write(require('$meta').orgId)")"
  proj="$(node -e "process.stdout.write(require('$meta').projectName)")"
  curl -sS --max-time 30 -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects/$proj?teamId=$org" \
  | node -e '
      let s = "";
      process.stdin.on("data", (d) => (s += d)).on("end", () => {
        try {
          const j = JSON.parse(s);
          const a =
            (j.targets && j.targets.production && j.targets.production.alias) ||
            j.alias ||
            [];
          const pick = a.find((x) => /^[^.]+\.vercel\.app$/.test(x)) || a[0];
          if (pick) process.stdout.write("https://" + pick);
        } catch {}
      });'
}

set_env() { # set_env <目录> <变量名> <值>
  local dir="$1" name="$2" value="$3"
  ( cd "$ROOT/$dir" && $V env add "$name" production --value "$value" --force --yes \
      --token "$VERCEL_TOKEN" >/dev/null 2>&1 )
  echo "   $name ✓"
}

say "1/6 创建 / 校验两个 Vercel 项目"
ensure_project "$WEB_PROJECT"
ensure_project "$AGENT_PROJECT"

say "2/6 关联本地目录与项目"
link_project web "$WEB_PROJECT"
link_project agent "$AGENT_PROJECT"
disable_protection web
disable_protection agent

say "3/6 写入 agent 项目环境变量"
set_env agent APP_ENV production
set_env agent SERVICE_TOKEN "$SERVICE_TOKEN"
set_env agent SILICONFLOW_API_KEY "$SILICONFLOW_API_KEY"
set_env agent SILICONFLOW_BASE_URL "$SILICONFLOW_BASE_URL"
set_env agent EMBEDDING_MODEL "$EMBEDDING_MODEL"
set_env agent VISION_MODEL "$VISION_MODEL"
set_env agent AI_BASE_URL "$AGENT_AI_BASE_URL"
set_env agent AI_MODEL "$AGENT_AI_MODEL"
set_env agent DATABASE_URL "$DATABASE_URL_DIRECT"

say "4/6 部署 agent 服务（Python FastAPI）"
AGENT_URL="$( cd "$ROOT/agent" && $V deploy --prod --yes --token "$VERCEL_TOKEN" 2>/dev/null | tail -1 )"
[ -n "$AGENT_URL" ] || { echo "agent 部署失败，未拿到 URL"; exit 1; }
AGENT_ALIAS="$(production_alias agent)"
if [ -n "$AGENT_ALIAS" ]; then
  echo "   本次部署地址：$AGENT_URL"
  echo "   稳定别名（注入 web 用这个）：$AGENT_ALIAS"
  AGENT_URL="$AGENT_ALIAS"
else
  echo "   agent 地址：$AGENT_URL（未取到稳定别名，暂用本次部署地址）"
fi

say "5/6 写入 web 项目环境变量（注入 agent 地址）"
set_env web APP_ENV production
set_env web DATABASE_URL "$DATABASE_URL_POOLED"
set_env web AUTH_SECRET "$AUTH_SECRET"
set_env web ENCRYPTION_KEY "$ENCRYPTION_KEY"
set_env web BLOB_READ_WRITE_TOKEN "$BLOB_READ_WRITE_TOKEN"
set_env web AI_BASE_URL "$AI_BASE_URL"
set_env web AI_MODEL "$AI_MODEL"
set_env web AGENT_BASE_URL "$AGENT_URL"
set_env web AGENT_SERVICE_TOKEN "$AGENT_SERVICE_TOKEN"
# Vercel 构建机在海外，用官方源覆盖本地 .npmrc 里的国内镜像，避免镜像缺版本
set_env web NPM_CONFIG_REGISTRY "https://registry.npmjs.org"

say "6/6 部署 web 应用（Next.js）"
WEB_URL="$( cd "$ROOT/web" && $V deploy --prod --yes --token "$VERCEL_TOKEN" 2>/dev/null | tail -1 )"
[ -n "$WEB_URL" ] || { echo "web 部署失败，未拿到 URL"; exit 1; }
WEB_ALIAS="$(production_alias web)"
[ -n "$WEB_ALIAS" ] && WEB_URL="$WEB_ALIAS"

say "自检"
# 中国大陆直连 *.vercel.app 会被阻断（本机 curl 不走系统代理）。
# 有代理就 export VERIFY_PROXY=http://127.0.0.1:7890，自检走代理；没有也不影响部署结果。
# 注：macOS 自带 bash 3.2 在 set -u 下展开空数组会报错，所以这里用函数而不是数组。
vcurl() { # vcurl <curl 参数...>
  if [ -n "${VERIFY_PROXY:-}" ]; then
    curl -sS --max-time 30 -x "$VERIFY_PROXY" "$@"
  else
    curl -sS --max-time 30 "$@"
  fi
}
echo -n "   agent /health → "
vcurl "$AGENT_URL/health" || echo "(超时：多半是本机到 vercel.app 的网络问题，用浏览器打开下面的网址确认)"
echo
echo -n "   web 首页      → "
vcurl -o /dev/null -w 'HTTP %{http_code}\n' "$WEB_URL" || echo "(同上)"

cat <<EOF

============================================================
🎉 上线完成

  网页入口： ${WEB_URL}
  Agent 服务： ${AGENT_URL}   （仅 BFF 调用，带 X-Service-Token 鉴权）
  区域：      ${REGION}（与 Neon ap-southeast-1 同区）

数据持久化：
  · 业务数据 → Neon PostgreSQL（免费版，pgvector 已启用）
  · 上传原文件 → Vercel Blob（免费 1GB）

后续更新：
  bash scripts/deploy-vercel.sh          # 重新部署最新代码
============================================================
EOF

# NoteMind 上线说明（Vercel Hobby 免费方案）

## 零、当前线上地址（已部署并验证）

| | 地址 |
| --- | --- |
| 网页入口 | https://notemind-nu.vercel.app |
| Agent 服务 | https://notemind-agent.vercel.app（仅 BFF 调用，带 `X-Service-Token`） |
| Vercel 项目 | `notemind`（web）、`notemind-agent`（agent） |

已验证通过的链路（2026-09-24）：

- 注册 / 登录（Auth.js JWT）→ Prisma 写入 Neon ✓
- 新建笔记 → web Server Action 调 agent → 分片 → SiliconFlow embedding → 写入 `note_chunks.embedding` ✓
- 上传 `notemind-e2e-test.md` → Vercel Blob → agent 解析 → `documents.status = ready`、`chunks` 带 1024 维向量 ✓
- 笔记列表 / 详情 / Markdown 渲染 / 导航 ✓

验证用的测试账号、笔记、文档、Blob 文件均已清理，数据库恢复原有 4 用户状态。

**注意：中国大陆直连 `*.vercel.app` 会被阻断，本机 `curl` 又不走系统代理，
所以命令行自检会超时——这不代表部署失败。** 浏览器走系统代理即可正常访问；
若要在命令行验证，先 `export VERIFY_PROXY=http://127.0.0.1:7890`。

## 一、最终形态

| 组件 | 平台 | 免费额度 | 说明 |
| --- | --- | --- | --- |
| `web/`（Next.js 16 + Prisma） | Vercel Hobby | 100 GB 带宽/月，函数单次最长 300s | 页面 + BFF API |
| `agent/`（Python 3.12 + FastAPI） | Vercel Hobby | 同上，Python 包体积上限 500MB | 分片 / 向量化 / RAG 对话 |
| 数据库 | Neon PostgreSQL 16（ap-southeast-1） | 0.5 GB 存储永久免费 | 已启用 `vector` + `pg_trgm`，7 个迁移已就绪 |
| 原文件存储 | Vercel Blob | 1 GB 存储 / 1 万读 / 2 千写 每月 | 上传的 PDF / 图片等 |

**为什么算"持久环境"**：无状态函数只是算力，所有业务数据都在 Neon（持久卷）与 Vercel Blob 里，
重新部署、函数冷启动、缩容到 0 都不会丢数据；Neon 免费库闲置会自动挂起，下次请求毫秒级唤醒，数据不动。
两个项目都挂在 Vercel 分配的 `*.vercel.app` 域名上，无需自备域名。

**区域选择 `sin1`（新加坡）**：与 Neon 的 `ap-southeast-1` 同区，避免跨太平洋往返。
Vercel 新建项目的默认区域是 `iad1`（美东），所以两个 `vercel.json` 都显式写了 `regions`。

## 二、一键部署

```bash
export VERCEL_TOKEN=xxxxx          # https://vercel.com/account/tokens 创建
bash scripts/deploy-vercel.sh
```

脚本做的事（幂等，可反复执行）：

1. 建/校验两个 Vercel 项目：`notemind`（web）、`notemind-agent`（agent）；
2. 关联本地目录，**关闭 Deployment Protection**（新项目默认开启，会让线上地址要求登录，外部完全打不通）；
3. 写入两端环境变量（值直接取自 `web/.env.local`、`agent/.env`，无需手抄密钥）；
4. 先部署 agent，取它的**稳定生产别名**（不是带 hash 的一次性地址），再作为 `AGENT_BASE_URL` 注入 web 后部署 web；
5. 自检：`curl $AGENT_URL/health` 与 web 首页状态码。

## 三、环境变量一览

**web 项目**

| 变量 | 值 |
| --- | --- |
| `APP_ENV` | `production`（导航栏徽章） |
| `DATABASE_URL` | Neon **连接池**地址（`-pooler` + `pgbouncer=true`），serverless 并发下不炸直连上限 |
| `AUTH_SECRET` | 复用本地值（换新会让已登录会话失效） |
| `ENCRYPTION_KEY` | **必须复用本地值**，否则已存的用户 AI Key 解不开 |
| `BLOB_READ_WRITE_TOKEN` | 复用本地 Blob store |
| `AI_BASE_URL` / `AI_MODEL` | `https://api.deepseek.com` / `deepseek-chat` |
| `AGENT_BASE_URL` | 部署 agent 后回填 |
| `AGENT_SERVICE_TOKEN` | 与 agent 的 `SERVICE_TOKEN` 一致 |
| `NPM_CONFIG_REGISTRY` | `https://registry.npmjs.org`，覆盖本地 `.npmrc` 的国内镜像 |

**agent 项目**

| 变量 | 值 |
| --- | --- |
| `APP_ENV` | `production` |
| `SERVICE_TOKEN` | 与 web 的 `AGENT_SERVICE_TOKEN` 一致 |
| `SILICONFLOW_API_KEY` 及 `SILICONFLOW_BASE_URL` / `EMBEDDING_MODEL` / `VISION_MODEL` | 免费 `BAAI/bge-m3` embedding + Qwen 视觉模型 |
| `DATABASE_URL` | Neon **直连**地址（psycopg 短连接，不走 PgBouncer） |

## 四、注意事项

1. **本地 Prisma 连不上 Neon 是 macOS 专属 bug，不影响线上。**
   报错 `P1011: Error opening a TLS connection: bad certificate format`
   来自 macOS 的 SecureTransport（`errSSLBadCert`）解析不了 Let's Encrypt 新链路
   （`Root YR` → `YR1` → `*.neon.tech`）。已用 Linux 容器验证：同一个 Prisma 6
   引擎在 Linux 上正常连上 Neon（`Database schema is up to date!`）。Vercel 是 Linux，正常。
   本地要跑 Prisma 只能换平台，或改走 Neon serverless driver。
2. **两个项目都是 `Root Directory` 独立部署**（web 在仓库根下 `web/`，agent 在 `agent/`），
   由各自的 `.vercel/project.json` 记录，互不干扰。
3. **线上只跑 `prisma migrate deploy` 之外的东西**：迁移已在 Neon 上执行完，
   脚本不自动跑迁移。以后新增迁移，本地 macOS 跑不了，可用 Vercel 构建机或任意 Linux 环境执行：
   `DATABASE_URL=<直连地址> npx prisma migrate deploy`。
4. Vercel Hobby 仅限个人非商用项目；函数单次最长 300s，本项目 `maxDuration = 60`，
   agent 调用超时 50s，余量充足。
5. agent 服务公网可达，但除 `/health` 外所有路由都校验 `X-Service-Token`，
   web BFF 是唯一调用方。

# NoteMind（智记）— AI 知识库笔记应用 · 全栈开发提示词

> 使用方式：一阶段一阶段来，每完成一个阶段并验收通过，再开始下一个。
> 跨会话时：先向 AI 简述"项目当前状态 + 已完成阶段"，再粘贴下一阶段提示词。
> 报错时：把完整错误信息直接贴给 AI。
> 换供应商：改 `AI_BASE_URL` / `AI_MODEL` 环境变量即可，代码一行不动。

## 通用设计基准（每个阶段都必须遵守）

> 以下要求已内置在每个阶段提示词中，AI 必须严格遵守：

```
## 设计基准（Apple 风格）
- 所有界面样式要设计精美，参考 Apple 公司的顶尖设计风格
- 遵循"内容优先、留白充足"原则，每屏聚焦单一任务
- 大量留白（卡片间距 ≥ 24px，页面内边距 ≥ 32px）
- 圆角：卡片 16px，按钮 12px（大圆角营造亲和感）
- 字体：系统字体栈，标题用 font-semibold + tracking-tight，正文 -0.01em
- 配色：白/浅灰背景，主色用蓝色系（如 #0071e3 Apple 蓝），文字用深灰 #1d1d1f
- 阴影：微妙且柔和，hover 时轻微上浮（shadow-md → shadow-lg + translateY(-1px)）
- 交互：hover/active 有 150ms 过渡动画，按钮按下有轻微缩放
- 细节：标签用圆角胶囊、图标用纤细描边、焦点态清晰可见
- 禁用状态、加载状态（骨架屏）、空状态都要有设计感
- 保持风格全局统一，不混用不协调的设计语言
```

---

## 阶段 1：项目初始化 + 数据库 + 多环境配置

```
你是资深全栈工程师，精通 Next.js、Prisma、PostgreSQL。请帮我从零搭建一个全栈 AI 知识库笔记应用（项目名 NoteMind）的骨架，并完成数据库连接与多环境配置。

## 技术栈
- Next.js（最新稳定版，App Router + TypeScript + Tailwind CSS）
- Prisma ORM + PostgreSQL
- 数据库：Neon（标准 PostgreSQL 连接串）
- 环境变量：.env.local / .env.example / .env.production

## 设计基准（Apple 风格）
- 所有界面样式要设计精美，参考 Apple 公司的顶尖设计风格
- 遵循"内容优先、留白充足"原则，每屏聚焦单一任务
- 大量留白（卡片间距 ≥ 24px，页面内边距 ≥ 32px）
- 圆角：卡片 16px，按钮 12px（大圆角营造亲和感）
- 字体：系统字体栈，标题用 font-semibold + tracking-tight，正文 -0.01em
- 配色：白/浅灰背景，主色用蓝色系（如 #0071e3 Apple 蓝），文字用深灰 #1d1d1f
- 阴影：微妙且柔和，hover 时轻微上浮（shadow-md → shadow-lg + translateY(-1px)）
- 交互：hover/active 有 150ms 过渡动画，按钮按下有轻微缩放
- 细节：标签用圆角胶囊、图标用纤细描边、焦点态清晰可见
- 禁用状态、加载状态（骨架屏）、空状态都要有设计感
- 保持风格全局统一，不混用不协调的设计语言

## 项目背景
这是我的求职作品集项目，我是前端转全栈，正在系统学习后端，因此关键代码必须写中文注释，解释"为什么这么做"，方便我学习。

## 任务
1. 用 create-next-app 初始化项目（TypeScript、Tailwind、ESLint、App Router）
2. 安装并初始化 Prisma，连接 Neon 的 PostgreSQL 数据库
3. 设计核心数据模型，写入 schema.prisma：
   - User：id、email(unique)、name、passwordHash(可空)、createdAt、updatedAt
   - Note：id、title、content(Text)、pinned(默认false)、authorId(外键,级联删除)、createdAt、updatedAt，关联 author 和 tags
   - Tag：id、name、ownerId、与 Note 多对多（隐式关系表），ownerId+name 复合唯一
   - Chat：id、title、authorId(级联删除)、createdAt、关联 messages
   - ChatMessage：id、chatId、role(user/assistant)、content(Text)、createdAt
4. 多环境配置：
   - .env.local：DATABASE_URL、AUTH_SECRET、AUTH_GOOGLE_ID、AUTH_GOOGLE_SECRET、DEEPSEEK_API_KEY、AI_BASE_URL、AI_MODEL 全部占位
   - .env.example：同结构但用占位符 + 注释说明每个变量的用途（此文件提交到 Git）
   - 确认 .gitignore 忽略 .env.local
   - 用 Prisma 官方推荐的迁移方式：本地 prisma migrate dev / 生产 prisma migrate deploy
5. 运行 prisma migrate dev 生成初始迁移并推送到 Neon
6. 在根布局 layout.tsx 加一个简单的全局导航条占位（首页/笔记/登录），按 Apple 风格设计

## 技术要点（请在代码注释中体现）
- Prisma 多对多隐式关系表的写法
- 复合唯一约束 @@unique 的含义
- 外键 onDelete: Cascade 的作用
- 本地/生产环境变量如何切换

## 验收标准
- npm run dev 正常启动，无 TypeScript 错误
- prisma studio 能看到全部数据表
- 访问首页能看到导航条占位（Apple 风格）
- .env.local 不会出现在 Git 提交中

## 注意事项
- 不要创建不必要的文件
- 数据库连接失败时给出排查方法
- 完成后给我一份"项目结构说明"，解释每个关键目录/文件的用途
```

---

## 阶段 2：认证系统（Auth.js + Google OAuth + 邮箱密码）

```
你是资深全栈工程师。在已搭好的项目骨架（Next.js + Prisma + PostgreSQL，含 User 模型）上，为 NoteMind 实现完整用户认证。

## 设计基准（Apple 风格）
- 所有界面样式要设计精美，参考 Apple 公司的顶尖设计风格
- 登录/注册页做成居中卡片，圆角 16px，柔和阴影，主按钮为 Apple 蓝 #0071e3
- 输入框圆角 12px，聚焦有清晰光晕，表单错误提示用红色系但保持克制
- 按钮 hover/active 有 150ms 过渡，主按钮按下轻微缩放
- 大量留白，页面整体视觉干净、无杂乱装饰

## 背景
项目已配置好 Prisma 和 Neon 数据库，User 模型含 passwordHash 字段，根布局有导航条占位。

## 任务
1. 集成 Auth.js（next-auth v5，App Router 写法）：
   - 使用 JWT 会话策略
   - 配置 Google OAuth Provider（AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET 写入 .env.local）
   - 同时支持 Credentials（邮箱+密码）登录，密码用 bcrypt 哈希存储
   - 首次登录时自动在 User 表创建用户（Prisma adapter 或手动 upsert）
2. 实现页面：
   - /login 登录页（Google 按钮 + 邮箱密码表单，Zod 校验）
   - /register 注册页（邮箱密码，Zod 校验，注册后自动登录）
   - 导航条：未登录显示"登录/注册"，已登录显示用户名和"退出"
3. 添加 middleware.ts 保护 /notes、/chat 等需登录的路由
4. 提供服务端获取当前用户的 helper（getCurrentUser）

## 技术要点（请在代码注释中体现）
- Auth.js v5 的 AuthConfig、providers、callbacks（jwt/session）各自的作用
- JWT 会话 vs 数据库会话的区别
- 为什么密码要用 bcrypt（加盐、慢哈希）
- middleware 如何做路由守卫
- Credentials 与 OAuth 的流程差异

## 验收标准
- 能用 Google 账号登录/退出，刷新后会话保持
- 能用邮箱密码注册、登录、退出
- 未登录访问 /notes 被重定向到 /login
- 数据库中新注册用户的 passwordHash 不是明文
- 登录状态在导航条正确显示

## 注意事项
- Google OAuth 回调地址填 http://localhost:3000/api/auth/callback/google
- 若本地 Google 测试麻烦，至少保证邮箱密码登录完整可用
- 完成后给出"认证流程说明"：从点击登录到会话建立的全过程
```

---

## 阶段 3：笔记 CRUD（Server Actions + Zod）

```
你是资深全栈工程师。在已有项目（Next.js + Prisma + Auth.js）基础上，为 NoteMind 实现笔记的完整 CRUD。

## 设计基准（Apple 风格）
- 所有界面样式要设计精美，参考 Apple 公司的顶尖设计风格
- 笔记列表：卡片式布局，卡片圆角 16px、柔和阴影、hover 轻微上浮，间距 ≥ 24px
- 编辑器：简洁工具栏 + 大留白的书写区，Markdown 预览排版美观（行高、段间距考究）
- 空状态：设计一个漂亮的插画式引导（图标 + 主标题 + 副文案 + 主按钮）
- 加载用骨架屏（shimmer 微光动画），删除确认弹窗设计克制优雅

## 背景
已有认证系统，登录用户需要管理自己的个人笔记。

## 任务
1. 数据访问层（Server Actions）：
   - createNote：创建笔记（标题、内容），Zod 校验，归属当前用户
   - updateNote：更新笔记，校验所有权（防止越权改他人笔记）
   - deleteNote：删除笔记，校验所有权
   - togglePin：置顶/取消置顶
   - getNotes / getNoteById：查询，按 updatedAt 倒序
2. UI 实现（shadcn/ui 或手写 Tailwind 均可）：
   - /notes 列表页：卡片展示标题、更新时间、标签、置顶标识
   - /notes/new 新建页、/notes/[id] 详情页（支持编辑）
   - Markdown 渲染（react-markdown）+ 简单编辑工具栏
   - 表单受控组件 + Zod 校验，错误提示友好
3. 交互优化：
   - 新建/编辑后跳转回列表
   - 删除用确认弹窗
   - 置顶笔记置顶展示
   - 加载状态 / 空状态（无笔记时的引导文案）

## 技术要点（请在代码注释中体现）
- Server Actions vs API Route 的选择与区别（本项目用 Server Actions）
- Zod 校验为什么必须放在服务端
- 如何用 session 中的 userId 保证数据隔离（多租户思路）
- 所有权校验（每次写操作都查 authorId === 当前用户）

## 验收标准
- 登录后能新建/编辑/删除/置顶笔记，刷新后数据仍在
- 两个不同账号互相看不到、删不掉对方的笔记
- 空值/超长输入有校验提示
- 无笔记时显示空状态引导

## 注意事项
- 所有写操作必须在服务端校验所有权，前端校验只是体验优化
- 完成后给出"一个 CRUD 请求的完整链路说明"（点击按钮 → 前端 → Server Action → Prisma → 数据库 → 响应）
```

---

## 阶段 4：标签系统 + 全文搜索

```
你是资深全栈工程师。在已有项目基础上，为 NoteMind 添加标签系统和全文搜索。

## 设计基准（Apple 风格）
- 所有界面样式要设计精美，参考 Apple 公司的顶尖设计风格
- 标签用圆角胶囊样式，底色柔和（蓝色系 10% 透明度），hover 加深
- 搜索框居中、圆角 12px、聚焦有光晕，搜索无结果时展示设计优雅的空状态
- 标签页用"标签云/卡片"展示，数量用纤细数字徽标

## 背景
已有笔记 CRUD，Tag 与 Note 多对多关系已定义，ownerId+name 复合唯一。

## 任务
1. 标签系统：
   - 新建/编辑笔记时可添加标签（输入框回车添加）
   - 输入时联想当前用户已有标签（自动补全）
   - 笔记详情页展示标签，点击标签筛选该标签下的笔记
   - 标签列表页 /tags：展示所有标签及每个标签的笔记数量（Prisma groupBy 统计）
2. 全文搜索：
   - /notes 顶部搜索框，输入即搜（防抖 300ms）
   - 启用 pg_trgm 扩展，用 ILIKE 对标题+内容模糊搜索（注释中说明 tsvector 全文本检索是进阶方案）
   - 搜索结果高亮匹配词
   - 支持"标签筛选 + 关键词搜索"组合
3. 数据库变更：如需启用扩展，用 prisma migrate dev --create-only 手动补 SQL

## 技术要点（请在代码注释中体现）
- Prisma 隐式多对多的增删改写法
- groupBy 聚合查询
- 复合唯一约束如何保证"同一用户下标签名不重复"
- ILIKE + pg_trgm 索引的原理和适用场景
- 防抖实现

## 验收标准
- 能加/删标签，刷新后保留
- 同一用户下同名标签不会重复创建
- 搜索按标题和内容模糊匹配，结果实时刷新
- 标签筛选和搜索可组合使用
- /tags 页面能统计每个标签的笔记数量

## 注意事项
- 标签名要 trim 和去重
- 搜索无结果时展示提示
- 完成后解释"为什么全文搜索不建议在应用层用 JavaScript 遍历"
```

---

## 阶段 5：AI 功能（DeepSeek 流式对话 + 摘要）

```
你是资深全栈工程师。在已有项目基础上，为 NoteMind 集成 DeepSeek 大模型，实现 AI 对话和笔记摘要。

## 设计基准（Apple 风格）
- 所有界面样式要设计精美，参考 Apple 公司的顶尖设计风格
- 聊天窗口仿 iMessage：气泡圆角 18px，用户消息右对齐（Apple 蓝），AI 消息左对齐（浅灰）
- 消息流式打字机效果，输入框底部固定、圆角大、聚焦有光晕
- 侧边栏会话列表干净简洁，当前会话高亮
- 流式生成时显示优雅的"停止生成"按钮

## 背景
已有认证、笔记 CRUD、标签。环境变量已含 DEEPSEEK_API_KEY、AI_BASE_URL=https://api.deepseek.com、AI_MODEL=deepseek-chat。

## 任务
1. AI 配置：
   - 安装 openai npm 包，封装 lib/ai.ts，用 baseURL 指向 DeepSeek，所有 AI 调用统一走这里
   - API key 只在服务端使用（server-only），绝不能泄露到浏览器
2. 笔记 AI 功能（笔记详情页）：
   - "AI 摘要"按钮：把笔记内容发给模型生成摘要，流式显示
   - "AI 续写"按钮：根据笔记内容继续扩写
   - 提示词包含笔记上下文，设定"你是笔记助手"角色
3. AI 对话（/chat）：
   - 左侧会话列表 + 右侧聊天窗口
   - 用 Vercel AI SDK 的 useChat 或手写流式 fetch（推荐 AI SDK，并讲解流式原理）
   - 对话时把当前用户最近若干条笔记的标题+摘要注入上下文（简单 RAG 思路）
   - 消息存入数据库（Chat / ChatMessage 模型已定义）
   - 支持新建会话、查看历史会话
4. 体验细节：
   - AI 回复打字机式流式渲染
   - 流式期间显示停止按钮，输入时禁用发送
   - 超时/余额不足时显示友好错误

## 技术要点（请在代码注释中体现）
- OpenAI 兼容协议是什么，为什么 DeepSeek 只需改 baseURL
- 流式响应（SSE / ReadableStream）原理
- 为什么 API key 必须放服务端（server-only）
- 简单 RAG：把笔记内容注入提示词的思路
- 上下文窗口与 token 的概念

## 验收标准
- 笔记页能流式生成摘要和续写
- 对话流式回复，刷新后历史消息还在
- 新用户聊天时能"感知"其笔记内容（上下文注入生效）
- 前端网络面板中看不到 API key
- 报错时不会白屏

## 注意事项
- 流式输出要处理 finish_reason 和 error 事件
- 控制注入上下文大小，避免超 token 限制
- 完成后给出"一次 AI 流式对话的完整链路说明"
```

---

## 阶段 6：生产级打磨 + Vercel 部署上线

```
你是资深全栈工程师。对 NoteMind 做最后打磨并部署到 Vercel 公网，让它达到能放上简历的生产级质量。

## 设计基准（Apple 风格）
- 所有界面样式要设计精美，参考 Apple 公司的顶尖设计风格
- 404 / 500 错误页：设计成 Apple 式极简风格（大标题 + 一句安抚文案 + 返回按钮）
- loading.tsx 骨架屏与真实内容结构对齐，过渡自然
- 移动端布局精调：导航、编辑器、聊天窗口在手机上的体验流畅
- 品牌感：favicon、metadata 配图、Open Graph 分享图都保持一致的视觉语言

## 背景
项目已完成认证、笔记 CRUD、标签、搜索、AI 对话，现在要上线。

## 任务
1. 生产级打磨：
   - 全局 error.tsx、not-found.tsx、loading.tsx 骨架屏
   - 统一的空状态/加载状态组件
   - 移动端响应式检查
   - 表单和按钮的 loading 反馈
   - 基础 SEO：metadata、Open Graph、favicon
   - 确认合理使用 Server Components，优化 N+1 查询（Prisma include）
2. 安全与配置检查：
   - .env.local 未提交，完善 .env.example
   - 确认所有写操作有所有权校验
   - 对 AI 接口做简单限流（可选）
3. 部署到 Vercel：
   - 推送代码到 GitHub（配好 .gitignore、README）
   - Vercel 导入仓库，配置生产环境变量：DATABASE_URL、AUTH_SECRET、AUTH_GOOGLE_ID、AUTH_GOOGLE_SECRET、DEEPSEEK_API_KEY、AI_BASE_URL、AI_MODEL
   - Google OAuth 回调地址改为线上域名
   - 生产环境执行 prisma migrate deploy
   - 验证线上全部功能；可选绑定自定义域名
4. README：
   - 项目介绍、功能列表、技术栈、架构说明
   - 本地运行步骤、环境变量说明、部署步骤
   - 在线演示地址

## 技术要点
- Vercel 环境变量 vs 本地环境变量的区别（生产/预览/开发）
- 为什么生产用 migrate deploy 而本地用 migrate dev
- Server Components 与 Client Components 的边界
- 如何在 Vercel 排查线上问题（构建日志、Functions 日志）

## 验收标准
- 线上地址可访问，注册 → 笔记 → AI 对话全流程可用
- 404/500 页面友好
- 手机浏览器布局正常
- GitHub 仓库干净（无 .env、无 node_modules）
- README 能让陌生人 5 分钟跑起来

## 注意事项
- 部署失败按顺序排查：构建日志 → 环境变量 → 数据库连接 → 认证回调
- 完成后给出"上线检查清单"，逐项确认
```

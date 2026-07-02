# EssAI 一闪

灵光乍现，也有去处。

EssAI 是一个面向内容创作者的碎片收集与成稿工作台：用户随手收集碎片，选择一个或多个出稿方案，系统按方案与创作法则生成成稿，并保留每一次 AI 生成和手动编辑的稿次历史。

## Monorepo 结构

```text
packages/
  web/      # Next.js Web 应用和 Vercel API Routes
  mobile/   # Expo / React Native 移动端交互原型
```

根目录使用 npm workspaces 和 Turborepo 编排任务。当前 Web 应用在 `packages/web`，移动端原型在 `packages/mobile`。

## 当前版本

第一版已经搭好核心产品骨架：

- 拾光集：收集碎片，选择多个出稿方案，每个方案支持 x1 / x2 / x3 稿次
- 碎片札记：编辑碎片，手动出稿，查看派生出的成稿
- 方案簿 / 方案笺：创建和编辑出稿方案，绑定并排序创作法则
- 创作法典 / 法则条文：收录、修订、删除创作法则
- 成稿卷：查看稿次历史，左右切换稿次，再试一次，编辑后保存为新稿次
- AI SDK：默认通过 Vercel AI Gateway 调用 `openai/gpt-5.5`，本地没有密钥时使用 fallback 草稿
- Prisma：已按 Postgres 设计核心数据模型

## 本地开发

```bash
npm install
npm run dev
```

默认会通过 Turborepo 启动所有 workspace 的 `dev` 脚本。当前只有 Web 应用会真正启动，打开 `http://localhost:3000`。

只启动 Web：

```bash
npm run dev:web
```

启动移动端原型：

```bash
npm run dev:mobile
```

如果想先用浏览器看移动端 Web 预览：

```bash
npm --workspace @essai/mobile run web
```

## Vercel 部署

如果把 Web 作为独立 Vercel 项目部署，项目的 Root Directory 设置为：

```text
packages/web
```

移动端调试时可以让客户端请求本地 Web API，例如 `http://localhost:3000/api/...`。之后如果 API 需要独立出来，可以再拆成单独的 `packages/api`。

## 环境变量

复制 `packages/web/.env.example` 为 `packages/web/.env.local`，按需填写：

```bash
cp packages/web/.env.example packages/web/.env.local
```

AI 生成：

```env
AI_GATEWAY_API_KEY="..."
AI_MODEL="openai/gpt-5.5"
```

数据库：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/essai?sslmode=require"
```

当前 UI 默认使用开发期内存数据，方便没有数据库时直接跑通产品链路。接入正式 Postgres 后，可以把 `src/lib/data/demo-store.ts` 替换为 Prisma repository。

## Prisma

```bash
npm run db:generate
npm run db:push
npm run db:studio
```

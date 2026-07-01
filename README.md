# EssAI 一闪

灵光乍现，也有去处。

EssAI 是一个面向内容创作者的碎片收集与成稿工作台：用户随手收集碎片，选择一个或多个出稿方案，系统按方案与创作法则生成成稿，并保留每一次 AI 生成和手动编辑的稿次历史。

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

打开 `http://localhost:3000`。

## 环境变量

复制 `.env.example` 为 `.env.local`，按需填写：

```bash
cp .env.example .env.local
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

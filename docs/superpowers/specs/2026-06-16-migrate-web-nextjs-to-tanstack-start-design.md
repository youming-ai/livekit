# 设计：web/ 从 Next.js 迁移到 TanStack Start

- 日期：2026-06-16
- 状态：已批准，待实施
- 影响范围：仅 `web/` 前端框架；`agent/` 不变

## 1. 背景与动机

`web/` 当前基于 Next.js 16（App Router + RSC）。需求是改用 **TanStack Start**（基于 Vite 的全栈 React 框架）。本次迁移**只换框架**，UI 外观、交互、字幕逻辑与 LiveKit 集成保持不变。

参考（2026-06 核实）：TanStack Start 处于 **RC 阶段**（功能完整、API 稳定、即将 1.0），构建基于 Vite + `@tanstack/react-start/plugin/vite`。

- 从零搭建：https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
- Server Routes / Server Functions：https://tanstack.com/start/latest/docs/framework/react/guide/server-functions

## 2. 范围与非目标

**范围**
- 替换前端框架 Next.js 16 → TanStack Start（RC）。
- 路由、入口、构建、lint、env 适配到 TanStack Start。
- token 签发改为 TanStack Start **Server Function**。

**非目标**
- 不改 `agent/`。
- 不改 UI 设计与交互。
- 不重写业务逻辑：`captions.ts` / `captionStore.ts` / `join.ts` / `utils.ts` / `speakerColor.ts` / `format.ts` 原样平移。

## 3. 决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 迁移方式 | **就地改造 `web/`** | 应用小，git 历史连续，单目录 |
| token 接口 | **Server Function**（`createServerFn`） | 类型安全 RPC，免手写 fetch/JSON，贴合新栈 |
| 样式 | 保留 Tailwind v4 + shadcn | 组件为纯 React，零改动；Tailwind 改用 Vite 插件 |
| 字体 | Geist 改 `@fontsource-variable/geist(-mono)` | 替代 `next/font/google`，外观等价 |
| 测试 | 保留 Vitest | 已基于 Vite，迁移成本低 |

## 4. 目标目录结构

```
web/
  vite.config.ts          ← 新增（tanstackStart + viteReact + tailwindcss/vite）
  package.json            ← 改写依赖与 scripts
  tsconfig.json           ← paths: @/* → ./src/*
  eslint.config.mjs       ← 去 next，改 typescript-eslint + react-hooks
  vitest.config.ts        ← alias @ → ./src
  .env.local.example      ← NEXT_PUBLIC_LIVEKIT_URL → LIVEKIT_URL
  src/
    router.tsx            ← getRouter()
    routes/
      __root.tsx          ← 由 app/layout.tsx 转换（html/head/body + meta + 字体 + globals.css）
      index.tsx           ← 由 app/page.tsx（渲染 JoinForm）
      rooms.$room.tsx     ← 由 app/rooms/[room]/page.tsx
    lib/
      token.ts            ← buildAccessToken 不变 + requestToken server fn
      captions.ts captionStore.ts join.ts utils.ts speakerColor.ts format.ts  ← 平移
    components/           ← JoinForm / CaptionPanel / CaptionList / ui/* 平移
    styles/
      globals.css         ← 由 app/globals.css 平移
  src/routeTree.gen.ts    ← 由插件自动生成（gitignore）
  (删除：next.config.ts, app/, next-env.d.ts, .next/, postcss.config.mjs)
```

## 5. 依赖变更

**移除**：`next`、`eslint-config-next`、`@tailwindcss/postcss`、`postcss`

**新增**：
- `@tanstack/react-start`、`@tanstack/react-router`
- `vite`、`@tailwindcss/vite`
- `@fontsource-variable/geist`、`@fontsource-variable/geist-mono`
- `typescript-eslint`、`eslint-plugin-react-hooks`（dev）

**保留**：React 19 + react-dom、`@livekit/components-react`、`@livekit/components-styles`、`livekit-client`、`livekit-server-sdk`、cva / clsx / tailwind-merge / lucide-react / tw-animate-css / shadcn、Vitest 全家桶（含 `@vitejs/plugin-react`）

**scripts**：`dev: vite dev`、`build: vite build`、`test: vitest run`、`test:watch: vitest`、`lint: eslint`

## 6. 配置文件

### vite.config.ts
```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})
```

### tsconfig.json
- `paths: { "@/*": ["./src/*"] }`
- 移除 `next-env.d.ts` 引用与 next 插件项。

### vitest.config.ts
- 保留 `@vitejs/plugin-react`、`jsdom`、`globals`、`setupFiles`。
- `resolve.alias` `@` 指向 `./src`。

## 7. 路由与入口

### `src/router.tsx`
```ts
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true })
}
```

### `src/routes/__root.tsx`
- `createRootRoute({ head: () => ({ meta: [charset, viewport, {title:'双语会议字幕'}, description] }) })`
- `RootDocument`：`<html lang="zh-CN" suppressHydrationWarning>` → `<head><HeadContent/></head>` → `<body suppressHydrationWarning>{children}<Scripts/></body>`
- 顶部 `import '../styles/globals.css'`、`import '@fontsource-variable/geist'`、`import '@fontsource-variable/geist-mono'`；通过 className/CSS 提供 `--font-geist-sans`/`--font-geist-mono`。

### `src/routes/index.tsx`
- `createFileRoute('/')` → 渲染 `<JoinForm/>`。

### `src/routes/rooms.$room.tsx`
- `createFileRoute('/rooms/$room')`，`Route.useParams()` 取 `room`。
- `name` / `lang` 通过 search params 读取（沿用现有 query 约定 `?name=&lang=`），用 `validateSearch` 声明类型。
- **客户端边界**：`@livekit/components-react`（`LiveKitRoom`/`useLocalParticipant`）依赖浏览器 WebRTC，必须在客户端渲染。**首选** TanStack Router 的 `<ClientOnly>` 包裹 `<LiveKitRoom>`（`fallback` 给加载占位）；若所用 RC 版本未导出 `ClientOnly`，回退为 `useState(false)+useEffect` 的 mounted 守卫。SSR 阶段只渲染占位。

## 8. token Server Function

`src/lib/token.ts`：
- 保留纯函数 `buildAccessToken(apiKey, apiSecret, params)`（livekit-server-sdk，逻辑不变）。
- 新增：
```ts
export const requestToken = createServerFn({ method: 'POST' })
  .validator((d: JoinInput) => /* 复用 join.ts 的校验，确保 room/name 合法、lang ∈ {zh,ja} */)
  .handler(async ({ data }) => {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const url = process.env.LIVEKIT_URL
    if (!apiKey || !apiSecret || !url) throw new Error('服务端未配置 LiveKit 凭据')
    const identity = `${data.name}-${rand6()}`
    const token = await buildAccessToken(apiKey, apiSecret, { room: data.room, name: data.name, identity, spokenLang: data.lang })
    return { token, url }
  })
```
- `rooms.$room.tsx` 中 `const { token, url } = await requestToken({ data: { room, name, lang } })` 替换原 `fetch('/api/token')`，错误用 try/catch 映射到现有错误 UI。

## 9. 样式与字体

- Tailwind v4 改用 `@tailwindcss/vite`；删除 `postcss.config.mjs` 与 postcss 依赖。`globals.css` 中 `@import "tailwindcss"`、`@import "tw-animate-css"`、`@import "shadcn/tailwind.css"`、`@custom-variant`、主题变量等照旧。
- shadcn 组件（`components/ui/*`）为纯 React，零改动；`components.json` 的 `rsc: true` 改 `false`。
- 字体：移除 `next/font/google`，改 `@fontsource-variable/geist(-mono)`，在 root 引入并保留 `--font-geist-sans`/`--font-geist-mono` 变量，视觉等价。

## 10. 环境变量

| 旧（Next） | 新（TanStack Start） | 位置 |
|---|---|---|
| `LIVEKIT_API_KEY` | 不变 | 服务端 |
| `LIVEKIT_API_SECRET` | 不变 | 服务端 |
| `NEXT_PUBLIC_LIVEKIT_URL` | `LIVEKIT_URL` | 服务端（经 server fn 返回，不进客户端 bundle），与 agent 命名统一 |

同步更新 `web/.env.local.example` 与根 `README.md`（启动前端段落、env 列表）。

## 11. 测试与 lint

- 现有 6 个测试文件、18 个用例（`captionStore` / `captions` / `join` / `smoke` / `token` / `CaptionList`）目标**全部继续通过**。`token.test.ts` 测纯函数 `buildAccessToken`，不依赖框架。
- 组件测试经 `@vitejs/plugin-react` + jsdom 运行，alias `@` 调整后应无碍。
- ESLint：弃 `eslint-config-next`，改 `typescript-eslint` + `eslint-plugin-react-hooks` 的 flat config，目标 `npm run lint` 0 error（postcss 警告随 postcss 移除而消失）。

## 12. 验证标准（实施完成判据）

1. `npm install` 成功。
2. `npm run build` 成功产出。
3. `npm test` → 18/18 通过。
4. `npm run lint` → 0 error。
5. `npm run dev` 启动后：`/` 渲染加入页两步流程；`/rooms/<任意>` 进入连接流程（无凭据时显示「连接失败」错误 UI，而非崩溃）。
6. 填入真实凭据后，按 README 端到端步骤双设备验证字幕仍工作。

## 13. 风险与缓解

- **TanStack Start 为 RC（非 1.0）**：API 已稳定但未正式发版 → 在 README 注明所用版本。
- **LiveKit 与 SSR**：依赖浏览器 API → 客户端边界隔离（§7）。
- **字体加载方式变化**：@fontsource 与 next/font 行为不同 → 验证首屏字体与变量名生效。
- **routeTree.gen.ts**：插件自动生成 → 加入 `.gitignore`，避免提交生成物。

## 14. 实施大纲（详细计划见后续 plan 文档）

1. 依赖换装（package.json、删 postcss）。
2. 新增 vite/tsconfig/eslint/vitest 配置。
3. 建 `src/` 骨架：router、`__root`、`index`、`rooms.$room`。
4. 平移 `lib/`、`components/`、`styles/`，调整 import 与 alias。
5. token 改 server function，改造 rooms 路由调用与客户端边界。
6. env 改名 + 更新 `.env.local.example` 与 README。
7. 删除 Next 产物（`app/`、`next.config.ts`、`next-env.d.ts`、`postcss.config.mjs`）。
8. 跑 build / test / lint / dev 冒烟，逐项对齐 §12。

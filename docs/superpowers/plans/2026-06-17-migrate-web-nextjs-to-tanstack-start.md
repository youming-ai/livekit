# Web 框架迁移（Next.js → TanStack Start）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `web/` 前端从 Next.js 16（App Router）就地迁移到 TanStack Start（RC），保持 UI、字幕逻辑、LiveKit 集成与 agent 完全不变。

**Architecture:** Vite + `@tanstack/react-start` 插件；文件式路由放在 `src/routes/`；token 签发改为 TanStack Start Server Function。业务逻辑与 shadcn 组件原样平移到 `src/`，路径别名 `@` 指向 `./src`，现有 Vitest 单测（18 用例）作为整个迁移过程的回归护栏。

**Tech Stack:** React 19、TanStack Start/Router（RC）、Vite、Tailwind v4（`@tailwindcss/vite`）、shadcn/ui、LiveKit、Vitest。

---

## 背景约定

- 所有命令在 `web/` 目录下执行（除非另写）。
- **回归护栏**：`npm test` 必须始终 18/18 通过。每个结构性改动后都要跑。
- 这是就地框架替换，迁移**中途 `npm run build`/`npm run dev` 会暂时不可用**，直到 Task 7 完成（所有路由就位、Next 产物删除）。单测不依赖 Next，全程保持绿色。
- 执行前应在隔离分支/worktree 进行（由 using-git-worktrees 在执行期处理）。

## 文件结构（迁移后）

```
web/
  vite.config.ts          创建：tanstackStart + viteReact + tailwindcss/vite
  vitest.config.ts        修改：alias @ → ./src
  tsconfig.json           修改：paths @/* → ./src/*；去 next 插件与 include
  eslint.config.mjs       重写：typescript-eslint + react-hooks
  package.json            修改：依赖与 scripts
  .gitignore              修改：加 TanStack 产物，去 next-env
  .env.local.example      修改：NEXT_PUBLIC_LIVEKIT_URL → LIVEKIT_URL
  components.json         修改：rsc → false
  public/favicon.ico      移动自 app/favicon.ico
  src/
    router.tsx            创建：getRouter()
    routeTree.gen.ts      自动生成（gitignore）
    routes/
      __root.tsx          创建：html/head/body + meta + 字体 + globals.css
      index.tsx           创建：渲染 JoinForm
      rooms.$room.tsx     创建：由 app/rooms/[room]/page.tsx 改写
    lib/                  移动自 lib/（token.ts 等）+ requestToken.ts（新）
    components/           移动自 components/（JoinForm 改路由跳转）
    styles/globals.css    移动自 app/globals.css（加字体变量）
  （删除：app/、next.config.ts、next-env.d.ts、postcss.config.mjs、app/page.module.css）
```

---

### Task 1: 替换依赖与 scripts

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: 卸载 Next 相关依赖**

Run:
```bash
npm uninstall next eslint-config-next @tailwindcss/postcss postcss
```
Expected: 卸载成功，无报错。

- [ ] **Step 2: 安装 TanStack Start 运行时依赖**

Run:
```bash
npm install @tanstack/react-start @tanstack/react-router @tailwindcss/vite @fontsource-variable/geist @fontsource-variable/geist-mono
```
Expected: 解析并写入 `package.json` 的 `dependencies`。

- [ ] **Step 3: 安装构建/lint devDependencies**

Run:
```bash
npm install -D vite typescript-eslint eslint-plugin-react-hooks @eslint/js
```
Expected: 写入 `devDependencies`（`@vitejs/plugin-react`、`vitest`、`jsdom` 等已存在保持不变）。

- [ ] **Step 4: 改写 package.json 的 scripts**

把 `"scripts"` 改为：
```json
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```
并在 `package.json` 顶层确保有 `"type": "module"`（若无则加上）。

- [ ] **Step 5: 确认单测护栏仍绿**

Run: `npm test`
Expected: `Test Files 6 passed (6) / Tests 18 passed (18)`（测试不依赖 Next，移除后应照常通过）。

- [ ] **Step 6: 提交**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(web): swap Next.js deps for TanStack Start + Vite"
```

---

### Task 2: 新增 Vite 配置，移除 postcss，重写 eslint

**Files:**
- Create: `web/vite.config.ts`
- Delete: `web/postcss.config.mjs`
- Modify: `web/eslint.config.mjs`

- [ ] **Step 1: 创建 `web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
```

- [ ] **Step 2: 删除 postcss 配置（Tailwind 改走 Vite 插件）**

Run:
```bash
git rm web/postcss.config.mjs
```

- [ ] **Step 3: 重写 `web/eslint.config.mjs`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  globalIgnores([
    "dist/**",
    ".output/**",
    ".nitro/**",
    ".tanstack/**",
    "src/routeTree.gen.ts",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
```
> 注：新 lint 配置可能比 eslint-config-next 更/少严格，若产生新报错统一在 Task 10 修复。

- [ ] **Step 4: 单测护栏**

Run: `npm test`
Expected: 18/18 通过（此任务未动源码与 alias）。

- [ ] **Step 5: 提交**

```bash
git add web/vite.config.ts web/eslint.config.mjs
git commit -m "build(web): add Vite/TanStack config, drop postcss, eslint flat config"
```

---

### Task 3: 源码移入 `src/`，切换路径别名

**Files:**
- Move: `web/lib/` → `web/src/lib/`
- Move: `web/components/` → `web/src/components/`
- Move: `web/app/globals.css` → `web/src/styles/globals.css`
- Delete: `web/app/page.module.css`（已确认无引用）
- Modify: `web/vitest.config.ts`, `web/tsconfig.json`

- [ ] **Step 1: 移动业务代码与样式到 `src/`**

Run:
```bash
mkdir -p web/src/styles
git mv web/lib web/src/lib
git mv web/components web/src/components
git mv web/app/globals.css web/src/styles/globals.css
git rm web/app/page.module.css
```
（`@/...` 形式的 import 字符串不变；别名指向改到 `src` 即可继续解析。）

- [ ] **Step 2: 更新 `web/vitest.config.ts` 的别名指向 `./src`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 3: 重写 `web/tsconfig.json`（去 Next，别名指向 src）**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts", "vitest.setup.ts"],
  "exclude": ["node_modules", ".output", ".nitro"]
}
```

- [ ] **Step 4: 单测护栏（关键校验：别名生效）**

Run: `npm test`
Expected: 18/18 通过。若报 `Cannot find module '@/...'`，检查 vitest alias 是否已指向 `./src`。

- [ ] **Step 5: 提交**

```bash
git add -A web/src web/vitest.config.ts web/tsconfig.json
git commit -m "refactor(web): move source into src/, point @ alias at src"
```

---

### Task 4: 路由骨架 — router、根路由、首页、字体变量

**Files:**
- Modify: `web/src/styles/globals.css`
- Create: `web/src/router.tsx`
- Create: `web/src/routes/__root.tsx`
- Create: `web/src/routes/index.tsx`
- Modify: `web/.gitignore`

- [ ] **Step 1: 在 `globals.css` 的 `:root` 顶部定义 Geist 字体变量**

把 `:root {` 块开头改为（仅新增前两行，其余变量保持不变）：
```css
:root {
  --font-geist-sans: "Geist Variable";
  --font-geist-mono: "Geist Mono Variable";
  --font-sans: var(--font-geist-sans), "PingFang SC", "Hiragino Sans GB", "Hiragino Kaku Gothic ProN", "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif;
  --font-heading: var(--font-sans);
  --font-mono: var(--font-geist-mono), "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```
（替代原先由 `next/font` 注入的 `--font-geist-sans/-mono`，字体族名对应 @fontsource-variable 包。）

- [ ] **Step 2: 创建 `web/src/router.tsx`**

```tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}
```

- [ ] **Step 3: 创建 `web/src/routes/__root.tsx`**

```tsx
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "../styles/globals.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "双语会议字幕" },
      { name: "description", content: "实时中↔日会议字幕：多人设备分轨 + 翻译" },
    ],
    links: [{ rel: "icon", href: "/favicon.ico" }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 创建 `web/src/routes/index.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { JoinForm } from "@/components/JoinForm";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <JoinForm />;
}
```

- [ ] **Step 5: 更新 `web/.gitignore`（加 TanStack 产物，去 next-env）**

把现有 next.js 段（`/.next/`、`/out/`）保留无妨，追加：
```
# TanStack Start / Vite
.output
.nitro
.tanstack
src/routeTree.gen.ts
```
并删除 `next-env.d.ts` 那一行（已无意义）。

- [ ] **Step 6: 单测护栏**

Run: `npm test`
Expected: 18/18 通过（新增路由文件不被测试导入）。

- [ ] **Step 7: 提交**

```bash
git add web/src/styles/globals.css web/src/router.tsx web/src/routes web/.gitignore
git commit -m "feat(web): TanStack router skeleton (root + index) and Geist font vars"
```

---

### Task 5: JoinForm 路由跳转改用 TanStack Router

**Files:**
- Modify: `web/src/components/JoinForm.tsx`

- [ ] **Step 1: 替换 `next/navigation` 为 `@tanstack/react-router`**

把第 3 行
```tsx
import { useRouter } from "next/navigation";
```
改为
```tsx
import { useNavigate } from "@tanstack/react-router";
```

- [ ] **Step 2: 替换 hook 与跳转逻辑**

把
```tsx
  const router = useRouter();
```
改为
```tsx
  const navigate = useNavigate();
```
并把 `submit` 里这段
```tsx
    const q = new URLSearchParams({
      name: r.value.name,
      lang: r.value.spokenLang,
    });
    router.push(`/rooms/${encodeURIComponent(r.value.room)}?${q.toString()}`);
```
改为
```tsx
    navigate({
      to: "/rooms/$room",
      params: { room: r.value.room },
      search: { name: r.value.name, lang: r.value.spokenLang },
    });
```
（TanStack Router 负责参数编码；类型与 Task 7 的 rooms 路由 params/search 对齐。）

- [ ] **Step 3: 单测护栏**

Run: `npm test`
Expected: 18/18 通过（JoinForm 无独立单测，确保未破坏 import 解析与其它测试）。

- [ ] **Step 4: 提交**

```bash
git add web/src/components/JoinForm.tsx
git commit -m "refactor(web): JoinForm navigation via TanStack Router useNavigate"
```

---

### Task 6: token Server Function

**Files:**
- Create: `web/src/lib/requestToken.ts`

> `src/lib/token.ts` 的纯函数 `buildAccessToken` 保持不变（其单测 `token.test.ts` 继续覆盖 JWT 正确性）。server function 单独成文件，避免被单测在 import 时拉入服务端运行时。

- [ ] **Step 1: 创建 `web/src/lib/requestToken.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { buildAccessToken } from "@/lib/token";
import { validateJoin } from "@/lib/join";
import type { Lang } from "@/lib/captions";

export interface RequestTokenInput {
  room: string;
  name: string;
  lang: Lang;
}

export const requestToken = createServerFn({ method: "POST" })
  .validator((input: RequestTokenInput) => {
    const r = validateJoin({
      name: input.name,
      room: input.room,
      spokenLang: input.lang,
    });
    if (!r.ok) throw new Error(r.error);
    return r.value; // { name, room, spokenLang }
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !url) {
      throw new Error("服务端未配置 LiveKit 凭据");
    }
    const identity = `${data.name}-${Math.random().toString(36).slice(2, 8)}`;
    const token = await buildAccessToken(apiKey, apiSecret, {
      room: data.room,
      name: data.name,
      identity,
      spokenLang: data.spokenLang,
    });
    return { token, url };
  });
```

- [ ] **Step 2: 单测护栏**

Run: `npm test`
Expected: 18/18 通过（`requestToken` 未被任何测试 import；`token.test.ts` 仍测 `buildAccessToken`）。

- [ ] **Step 3: 提交**

```bash
git add web/src/lib/requestToken.ts
git commit -m "feat(web): token minting as TanStack Start server function"
```

---

### Task 7: rooms 路由（改写 + 删除 Next 产物，恢复可构建）

**Files:**
- Create: `web/src/routes/rooms.$room.tsx`
- Move: `web/app/favicon.ico` → `web/public/favicon.ico`
- Delete: `web/app/`、`web/next.config.ts`、`web/next-env.d.ts`

- [ ] **Step 1: 创建 `web/src/routes/rooms.$room.tsx`**

```tsx
import { useEffect, useState } from "react";
import {
  Link,
  createFileRoute,
} from "@tanstack/react-router";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  ArrowLeft,
  Hash,
  User2,
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  LogOut,
} from "lucide-react";
import { requestToken } from "@/lib/requestToken";
import type { Lang } from "@/lib/captions";
import { CaptionPanel } from "@/components/CaptionPanel";
import { MicMuteIndicator } from "@/components/CaptionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface RoomSearch {
  name: string;
  lang: Lang;
}

export const Route = createFileRoute("/rooms/$room")({
  validateSearch: (search: Record<string, unknown>): RoomSearch => ({
    name: typeof search.name === "string" ? search.name : "",
    lang: search.lang === "ja" ? "ja" : "zh",
  }),
  component: RoomPage,
});

function RoomPage() {
  const { room } = Route.useParams();
  const { name, lang } = Route.useSearch();

  // LiveKit components touch browser-only WebRTC APIs; render them only after
  // mount so SSR emits the loading shell instead of crashing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mounted) return;
    requestToken({ data: { room, name, lang } })
      .then((data) => setConn({ token: data.token, url: data.url }))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, [mounted, room, name, lang]);

  if (error)
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">连接失败</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Link
              to="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              返回首页
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );

  if (!conn)
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center gap-3 pt-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <p className="text-sm">正在连接会议…</p>
          </CardContent>
        </Card>
      </Shell>
    );

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      audio
      video={false}
      onError={(e) => setError(e.message)}
    >
      <RoomAudioRenderer />
      <RoomBody room={room} name={name} lang={lang} />
    </LiveKitRoom>
  );
}

function RoomBody({
  room,
  name,
  lang,
}: {
  room: string;
  name: string;
  lang: Lang;
}) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <Link
            to="/"
            aria-label="返回首页"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15"
              aria-hidden
            >
              <Hash className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">房间 · {room}</span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Avatar className="size-4 text-[9px]">
                  {name.slice(0, 1).toUpperCase() || "•"}
                </Avatar>
                <span className="truncate">{name || "匿名"}</span>
                <span aria-hidden>·</span>
                <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                  {lang === "ja" ? "日本語 → 中文" : "中文 → 日本語"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <MicMuteIndicator muted={false} />
            </div>
            <MicToggle />
            <Link
              to="/"
              aria-label="离开会议"
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <User2 className="size-3.5" />
                </span>
                实时字幕
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">
                按成员自动分组
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <CaptionPanel />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function MicToggle() {
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={isMicrophoneEnabled ? "secondary" : "destructive"}
      aria-label={isMicrophoneEnabled ? "关闭麦克风" : "打开麦克风"}
      title={isMicrophoneEnabled ? "关闭麦克风" : "打开麦克风"}
      onClick={() => {
        localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      }}
    >
      {isMicrophoneEnabled ? (
        <Mic className="size-4" />
      ) : (
        <MicOff className="size-4" />
      )}
    </Button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-screen w-full items-center justify-center bg-background p-6 text-foreground",
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 迁移 favicon 并删除 Next 产物**

Run:
```bash
mkdir -p web/public
git mv web/app/favicon.ico web/public/favicon.ico
git rm -r web/app
git rm web/next.config.ts web/next-env.d.ts
```
Expected: `web/app/` 不再存在；favicon 位于 `web/public/`。

- [ ] **Step 3: 安装依赖并首次构建（关键里程碑）**

Run:
```bash
npm install
npm run build
```
Expected: TanStack Start 插件生成 `src/routeTree.gen.ts`，构建成功产出（`.output/`）。若报路由类型错误，核对 `rooms.$room.tsx` 的 `validateSearch`/params 名称与 `JoinForm` 的 `navigate` 调用一致。

- [ ] **Step 4: 单测护栏**

Run: `npm test`
Expected: 18/18 通过。

- [ ] **Step 5: 提交**

```bash
git add -A web
git commit -m "feat(web): rooms route on TanStack Start; remove Next.js artifacts"
```

---

### Task 8: 环境变量改名与文档同步

**Files:**
- Modify: `web/.env.local.example`
- Modify: `web/components.json`
- Modify: `README.md`（仓库根）

- [ ] **Step 1: 改 `web/.env.local.example`**

```
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=wss://your-project.livekit.cloud
```

- [ ] **Step 2: `web/components.json` 关掉 RSC**

把 `"rsc": true` 改为 `"rsc": false`。

- [ ] **Step 3: 更新根 `README.md` 的「启动前端」段落**

把 `web/.env.local` 的环境变量清单改为：
```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://your-project.livekit.cloud
```
并在「架构 · web/」描述里把 “Next.js” 改为 “TanStack Start（基于 Vite）”，附一句版本说明：`> 前端基于 TanStack Start（RC 版）。`

- [ ] **Step 4: 提交**

```bash
git add web/.env.local.example web/components.json README.md
git commit -m "docs(web): rename LIVEKIT_URL env, note TanStack Start in README"
```

---

### Task 9: 收尾验证（构建 / 测试 / lint / dev 冒烟）

**Files:** 无（仅验证；如发现问题在此修复并补提交）

- [ ] **Step 1: 干净安装与构建**

Run:
```bash
rm -rf web/node_modules/.vite web/.output
npm --prefix web install
npm --prefix web run build
```
Expected: 构建成功。

- [ ] **Step 2: 单测**

Run: `npm --prefix web test`
Expected: `Tests 18 passed (18)`。

- [ ] **Step 3: Lint（0 error）**

Run: `npm --prefix web run lint`
Expected: 退出码 0；如有 typescript-eslint 新增报错，逐个修复（常见：未用变量、显式 any），直到 0 error。

- [ ] **Step 4: dev 冒烟（首页）**

Run（后台起 dev，探测后关闭）：
```bash
( cd web && npm run dev ) &
DEV_PID=$!
sleep 6
curl -s http://localhost:3000/ | grep -q "选择你这边的语言" && echo "HOME OK" || echo "HOME FAIL"
kill $DEV_PID
```
Expected: 打印 `HOME OK`（首页渲染出语言选择卡片文案）。

- [ ] **Step 5: dev 冒烟（房间页，无凭据走错误/加载路径不崩溃）**

Run：
```bash
( cd web && npm run dev ) &
DEV_PID=$!
sleep 6
curl -s "http://localhost:3000/rooms/test?name=demo&lang=zh" | grep -qiE "正在连接|连接失败|实时字幕|html" && echo "ROOM OK" || echo "ROOM FAIL"
kill $DEV_PID
```
Expected: 打印 `ROOM OK`（房间路由 SSR 出壳层 HTML，不报 500）。

- [ ] **Step 6: 最终提交（若有修复）**

```bash
git add -A web
git commit -m "fix(web): resolve lint/build findings after TanStack migration"
```
> 真·端到端（双设备字幕）需填入真实 LiveKit/Deepgram/Gemini 凭据，按 README 手动验证，不在本计划自动步骤内。

---

## Self-Review（针对 spec 的覆盖核对）

- §3 决策（就地、server fn、保留 Tailwind/shadcn、@fontsource、保留 Vitest）→ Task 1–8 全覆盖。
- §4 目录结构 → Task 3/4/7 落地。
- §5 依赖 → Task 1。
- §6 vite/tsconfig/vitest 配置 → Task 2/3。
- §7 router/__root/index/rooms + 客户端边界 → Task 4/7（mounted 守卫，规避 RC 中 ClientOnly 导出不确定性）。
- §8 token server fn（+ 复用 validateJoin、identity 生成）→ Task 6；JoinForm 跳转 → Task 5。
- §9 字体变量与 Tailwind Vite 插件 → Task 2/4。
- §10 env 改名与文档 → Task 8。
- §11 测试/lint → 全程护栏 + Task 9。
- §12 验证标准 → Task 9 Step 1–5（端到端凭据部分明确标注为手动）。
- §13 风险（RC、SSR、字体、routeTree.gen）→ 分别由 README 说明、mounted 守卫、字体变量、.gitignore 处理。

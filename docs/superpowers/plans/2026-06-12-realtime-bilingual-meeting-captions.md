# 实时双语会议字幕系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建一个 Next.js 网页 + Python 转录 Agent，让多人各自用浏览器麦克风远程入会，实时显示「谁 + 原文 + 译文」的中↔日双语字幕。

**Architecture:** 浏览器经 WebRTC 连 LiveKit Cloud 房间并发布麦克风；后台 `livekit-agents` Python worker 订阅每个参与者音轨，用 Deepgram 流式 ASR 转文字，对每条 final 调 Gemini Flash 翻成对方语言，再通过 LiveKit data channel（topic `captions`）把「原文+译文」JSON 发回房间；前端按说话人渲染。说话人靠 LiveKit 参与者身份区分，无声纹模型。

**Tech Stack:** Next.js (App Router, TypeScript) + `@livekit/components-react` + `livekit-server-sdk`；前端测试用 Vitest + Testing Library。Python `livekit-agents` + `livekit-plugins-deepgram` + `google-genai`；Agent 测试用 pytest。

---

## 文件结构

```
web/                                # Next.js 前端
├── app/
│   ├── page.tsx                    # 加入页
│   ├── rooms/[room]/page.tsx       # 房间页（取 token → 连 LiveKit → 渲染字幕）
│   └── api/token/route.ts          # 服务端签发 token
├── components/
│   ├── JoinForm.tsx                # 加入表单
│   ├── CaptionPanel.tsx            # 容器：监听 data channel → reducer
│   └── CaptionList.tsx             # 纯展示：按 store 渲染双语字幕（可单测）
├── lib/
│   ├── captions.ts                 # 字幕协议类型 + encode/parse（前后端契约）
│   ├── captionStore.ts             # captionReducer（interim/final 状态机）
│   ├── join.ts                     # 加入表单校验
│   └── token.ts                    # buildAccessToken 助手
├── vitest.config.ts / vitest.setup.ts
└── .env.local.example

agent/                              # Python 转录 Agent
├── transcriber.py                  # worker 入口：订阅音轨→STT→翻译→发字幕
├── translate.py                    # Translator + GeminiClient + 语言映射
├── captions.py                     # 字幕 JSON 构造（镜像 lib/captions.ts）
├── tests/
│   ├── test_translate.py
│   └── test_captions.py
├── requirements.txt
├── Dockerfile                      # 容器化 worker（Python 3.12-slim）
├── .dockerignore
└── .env.example
docker-compose.yml                  # 仓库根：transcriber 服务（仅 Agent 容器化）
```

> **运行方式约定**：单元测试在本机 `uv`（Python 3.12）环境跑（快）；常驻 worker（transcriber.py）跑在 Docker 容器里（绕开本机 Python 版本、贴近部署）。web 用 `npm run dev` 本地跑。本机系统 Python 是 3.9，所有 Python 操作都经由 `uv`（已安装 0.11.21）。

**字幕协议（前后端必须一致）：** `interim` = `{type,sid,speaker,original}`；`final` = `{type,id,sid,speaker,srcLang,original,tgtLang,translation,ts}`。`srcLang`/`tgtLang` ∈ `"zh"|"ja"`。

---

## Task 1: 搭建 web/ Next.js 脚手架与测试环境

**Files:**
- Create: `web/`（create-next-app 生成）
- Create: `web/vitest.config.ts`、`web/vitest.setup.ts`
- Create: `web/lib/__tests__/smoke.test.ts`

- [ ] **Step 1: 生成 Next.js 应用**

Run（在仓库根目录）:
```bash
npx create-next-app@latest web --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm
```
Expected: 生成 `web/`，`tsconfig.json` 含 `"@/*": ["./*"]`。

- [ ] **Step 2: 安装运行期与测试依赖**

Run:
```bash
cd web && npm i @livekit/components-react @livekit/components-styles livekit-client livekit-server-sdk && npm i -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```
Expected: 安装成功，`package.json` 出现上述依赖。

- [ ] **Step 3: 写 Vitest 配置**

Create `web/vitest.config.ts`:
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
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

Create `web/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom";
```

在 `web/package.json` 的 `"scripts"` 加入：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 写冒烟测试**

Create `web/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `cd web && npm test`
Expected: PASS，1 个测试通过。

- [ ] **Step 6: 提交**

```bash
git add web .gitignore && git commit -m "chore: scaffold Next.js web app with vitest"
```

---

## Task 2: 搭建 agent/ Python 脚手架与测试环境

**Files:**
- Create: `agent/requirements.txt`、`agent/.env.example`、`agent/tests/test_smoke.py`、`agent/pytest.ini`

- [ ] **Step 1: 写依赖清单**

Create `agent/requirements.txt`:
```
livekit-agents>=1.0
livekit-plugins-deepgram
google-genai
python-dotenv
pytest
```

- [ ] **Step 2: 写环境变量示例**

Create `agent/.env.example`:
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
DEEPGRAM_API_KEY=
GOOGLE_API_KEY=
TRANSLATE_MODEL=gemini-2.5-flash
```

- [ ] **Step 3: 写 pytest 配置与冒烟测试**

Create `agent/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```

Create `agent/tests/test_smoke.py`:
```python
def test_smoke():
    assert 1 + 1 == 2
```

- [ ] **Step 4: 建虚拟环境并安装、运行测试**

Run:
```bash
cd agent && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && pytest -q
```
Expected: PASS，1 个测试通过。（若网络受限装不全依赖，至少确认 `pytest -q` 能跑起冒烟测试。）

- [ ] **Step 5: 提交**

```bash
git add agent && git commit -m "chore: scaffold python transcriber agent with pytest"
```

---

## Task 3: 字幕协议（web/lib/captions.ts）

**Files:**
- Create: `web/lib/captions.ts`
- Test: `web/lib/__tests__/captions.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/lib/__tests__/captions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { encodeCaption, parseCaption, type Caption } from "@/lib/captions";

const final: Caption = {
  type: "final",
  id: "seg_1",
  sid: "PA_x",
  speaker: "Tang",
  srcLang: "zh",
  original: "你好",
  tgtLang: "ja",
  translation: "こんにちは",
  ts: 1736668800000,
};

describe("captions protocol", () => {
  it("round-trips a final caption", () => {
    expect(parseCaption(encodeCaption(final))).toEqual(final);
  });

  it("round-trips an interim caption", () => {
    const interim: Caption = { type: "interim", sid: "PA_x", speaker: "Tang", original: "你…" };
    expect(parseCaption(encodeCaption(interim))).toEqual(interim);
  });

  it("returns null for invalid JSON", () => {
    expect(parseCaption(new TextEncoder().encode("not json"))).toBeNull();
  });

  it("returns null when a required field is missing", () => {
    const bad = new TextEncoder().encode(JSON.stringify({ type: "final", id: "x" }));
    expect(parseCaption(bad)).toBeNull();
  });

  it("returns null for an invalid lang value", () => {
    const bad = new TextEncoder().encode(JSON.stringify({ ...final, srcLang: "en" }));
    expect(parseCaption(bad)).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd web && npx vitest run lib/__tests__/captions.test.ts`
Expected: FAIL（`captions` 模块不存在）。

- [ ] **Step 3: 实现协议**

Create `web/lib/captions.ts`:
```ts
export type Lang = "zh" | "ja";

export interface InterimCaption {
  type: "interim";
  sid: string;
  speaker: string;
  original: string;
}

export interface FinalCaption {
  type: "final";
  id: string;
  sid: string;
  speaker: string;
  srcLang: Lang;
  original: string;
  tgtLang: Lang;
  translation: string;
  ts: number;
}

export type Caption = InterimCaption | FinalCaption;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeCaption(c: Caption): Uint8Array {
  return encoder.encode(JSON.stringify(c));
}

function isLang(v: unknown): v is Lang {
  return v === "zh" || v === "ja";
}

export function parseCaption(bytes: Uint8Array): Caption | null {
  let obj: unknown;
  try {
    obj = JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;

  if (o.type === "interim") {
    if (
      typeof o.sid === "string" &&
      typeof o.speaker === "string" &&
      typeof o.original === "string"
    ) {
      return { type: "interim", sid: o.sid, speaker: o.speaker, original: o.original };
    }
    return null;
  }

  if (o.type === "final") {
    if (
      typeof o.id === "string" &&
      typeof o.sid === "string" &&
      typeof o.speaker === "string" &&
      isLang(o.srcLang) &&
      typeof o.original === "string" &&
      isLang(o.tgtLang) &&
      typeof o.translation === "string" &&
      typeof o.ts === "number"
    ) {
      return {
        type: "final",
        id: o.id,
        sid: o.sid,
        speaker: o.speaker,
        srcLang: o.srcLang,
        original: o.original,
        tgtLang: o.tgtLang,
        translation: o.translation,
        ts: o.ts,
      };
    }
    return null;
  }

  return null;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd web && npx vitest run lib/__tests__/captions.test.ts`
Expected: PASS（5 个测试）。

- [ ] **Step 5: 提交**

```bash
git add web/lib/captions.ts web/lib/__tests__/captions.test.ts && git commit -m "feat: bilingual caption protocol with encode/parse"
```

---

## Task 4: 字幕状态机（web/lib/captionStore.ts）

**Files:**
- Create: `web/lib/captionStore.ts`
- Test: `web/lib/__tests__/captionStore.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/lib/__tests__/captionStore.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { captionReducer, emptyStore } from "@/lib/captionStore";
import type { Caption } from "@/lib/captions";

const interim = (sid: string, text: string): Caption => ({
  type: "interim", sid, speaker: sid, original: text,
});
const final = (id: string, sid: string): Caption => ({
  type: "final", id, sid, speaker: sid,
  srcLang: "zh", original: "你好", tgtLang: "ja", translation: "こんにちは", ts: 1,
});

describe("captionReducer", () => {
  it("stores an interim keyed by sid", () => {
    const s = captionReducer(emptyStore, interim("A", "你…"));
    expect(s.interims["A"].original).toBe("你…");
  });

  it("replaces an earlier interim from the same sid", () => {
    let s = captionReducer(emptyStore, interim("A", "你…"));
    s = captionReducer(s, interim("A", "你好…"));
    expect(s.interims["A"].original).toBe("你好…");
  });

  it("appends a final and clears that sid's interim", () => {
    let s = captionReducer(emptyStore, interim("A", "你…"));
    s = captionReducer(s, final("seg1", "A"));
    expect(s.finals).toHaveLength(1);
    expect(s.interims["A"]).toBeUndefined();
  });

  it("does not clear another sid's interim on final", () => {
    let s = captionReducer(emptyStore, interim("B", "ま…"));
    s = captionReducer(s, final("seg1", "A"));
    expect(s.interims["B"].original).toBe("ま…");
  });

  it("dedupes finals by id", () => {
    let s = captionReducer(emptyStore, final("seg1", "A"));
    s = captionReducer(s, final("seg1", "A"));
    expect(s.finals).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd web && npx vitest run lib/__tests__/captionStore.test.ts`
Expected: FAIL（`captionStore` 不存在）。

- [ ] **Step 3: 实现状态机**

Create `web/lib/captionStore.ts`:
```ts
import type { Caption, FinalCaption, InterimCaption } from "./captions";

export interface CaptionStore {
  finals: FinalCaption[];
  interims: Record<string, InterimCaption>;
}

export const emptyStore: CaptionStore = { finals: [], interims: {} };

export function captionReducer(store: CaptionStore, c: Caption): CaptionStore {
  if (c.type === "interim") {
    return { ...store, interims: { ...store.interims, [c.sid]: c } };
  }
  if (store.finals.some((f) => f.id === c.id)) {
    return store;
  }
  const interims = { ...store.interims };
  delete interims[c.sid];
  return { finals: [...store.finals, c], interims };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd web && npx vitest run lib/__tests__/captionStore.test.ts`
Expected: PASS（5 个测试）。

- [ ] **Step 5: 提交**

```bash
git add web/lib/captionStore.ts web/lib/__tests__/captionStore.test.ts && git commit -m "feat: caption reducer for interim/final state"
```

---

## Task 5: Token 签发助手与 API 路由

**Files:**
- Create: `web/lib/token.ts`、`web/app/api/token/route.ts`
- Test: `web/lib/__tests__/token.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/lib/__tests__/token.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildAccessToken } from "@/lib/token";

function decodePayload(jwt: string): any {
  const [, payload] = jwt.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

describe("buildAccessToken", () => {
  it("issues a JWT granting room join with the spoken_lang attribute", async () => {
    const jwt = await buildAccessToken("devkey", "devsecret-at-least-32-chars-long!!", {
      room: "meeting1",
      identity: "tang-abc",
      name: "Tang",
      spokenLang: "zh",
    });
    expect(jwt.split(".")).toHaveLength(3);
    const p = decodePayload(jwt);
    expect(p.video.room).toBe("meeting1");
    expect(p.video.roomJoin).toBe(true);
    expect(p.attributes.spoken_lang).toBe("zh");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd web && npx vitest run lib/__tests__/token.test.ts`
Expected: FAIL（`token` 模块不存在）。

- [ ] **Step 3: 实现 token 助手**

Create `web/lib/token.ts`:
```ts
import { AccessToken } from "livekit-server-sdk";
import type { Lang } from "./captions";

export interface TokenParams {
  room: string;
  identity: string;
  name: string;
  spokenLang: Lang;
}

export async function buildAccessToken(
  apiKey: string,
  apiSecret: string,
  params: TokenParams,
): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name,
    attributes: { spoken_lang: params.spokenLang },
  });
  at.addGrant({
    room: params.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  return at.toJwt();
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd web && npx vitest run lib/__tests__/token.test.ts`
Expected: PASS。（若该版本 SDK 未把 attributes 放进 JWT，改用 `metadata: JSON.stringify({spoken_lang})` 并相应调整断言与 Agent 读取方式。）

- [ ] **Step 5: 写 API 路由**

Create `web/app/api/token/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { buildAccessToken } from "@/lib/token";
import type { Lang } from "@/lib/captions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: "服务端未配置 LiveKit 凭据" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const room = typeof b.room === "string" ? b.room.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const spokenLang = b.spokenLang;
  if (!room || !name || (spokenLang !== "zh" && spokenLang !== "ja")) {
    return NextResponse.json({ error: "缺少或非法的字段：room/name/spokenLang" }, { status: 400 });
  }

  const identity = `${name}-${Math.random().toString(36).slice(2, 8)}`;
  const token = await buildAccessToken(apiKey, apiSecret, {
    room,
    name,
    identity,
    spokenLang: spokenLang as Lang,
  });
  return NextResponse.json({ token, url });
}
```

- [ ] **Step 6: 提交**

```bash
git add web/lib/token.ts web/lib/__tests__/token.test.ts web/app/api/token/route.ts && git commit -m "feat: server-side LiveKit token issuance"
```

---

## Task 6: 加入表单校验与加入页

**Files:**
- Create: `web/lib/join.ts`、`web/components/JoinForm.tsx`、`web/app/page.tsx`
- Test: `web/lib/__tests__/join.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/lib/__tests__/join.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateJoin } from "@/lib/join";

describe("validateJoin", () => {
  it("accepts valid input and trims", () => {
    const r = validateJoin({ name: " Tang ", room: " m1 ", spokenLang: "zh" });
    expect(r).toEqual({ ok: true, value: { name: "Tang", room: "m1", spokenLang: "zh" } });
  });
  it("rejects empty name", () => {
    expect(validateJoin({ name: "", room: "m1", spokenLang: "zh" }).ok).toBe(false);
  });
  it("rejects empty room", () => {
    expect(validateJoin({ name: "Tang", room: "", spokenLang: "zh" }).ok).toBe(false);
  });
  it("rejects invalid lang", () => {
    expect(validateJoin({ name: "Tang", room: "m1", spokenLang: "en" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd web && npx vitest run lib/__tests__/join.test.ts`
Expected: FAIL（`join` 不存在）。

- [ ] **Step 3: 实现校验**

Create `web/lib/join.ts`:
```ts
import type { Lang } from "./captions";

export interface JoinInput {
  name: string;
  room: string;
  spokenLang: Lang;
}

type Result =
  | { ok: true; value: JoinInput }
  | { ok: false; error: string };

export function validateJoin(input: {
  name?: string;
  room?: string;
  spokenLang?: string;
}): Result {
  const name = (input.name ?? "").trim();
  const room = (input.room ?? "").trim();
  if (!name) return { ok: false, error: "请输入昵称" };
  if (!room) return { ok: false, error: "请输入房间名" };
  if (input.spokenLang !== "zh" && input.spokenLang !== "ja") {
    return { ok: false, error: "请选择你的母语" };
  }
  return { ok: true, value: { name, room, spokenLang: input.spokenLang } };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd web && npx vitest run lib/__tests__/join.test.ts`
Expected: PASS（4 个测试）。

- [ ] **Step 5: 写加入表单组件**

Create `web/components/JoinForm.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateJoin } from "@/lib/join";

export function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [spokenLang, setSpokenLang] = useState("zh");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = validateJoin({ name, room, spokenLang });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const q = new URLSearchParams({ name: r.value.name, lang: r.value.spokenLang });
    router.push(`/rooms/${encodeURIComponent(r.value.room)}?${q.toString()}`);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <h1>双语会议字幕</h1>
      <input placeholder="昵称" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="房间名" value={room} onChange={(e) => setRoom(e.target.value)} />
      <select value={spokenLang} onChange={(e) => setSpokenLang(e.target.value)}>
        <option value="zh">我说中文</option>
        <option value="ja">私は日本語を話す</option>
      </select>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">加入会议</button>
    </form>
  );
}
```

- [ ] **Step 6: 写加入页**

Replace `web/app/page.tsx` with:
```tsx
import { JoinForm } from "@/components/JoinForm";

export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <JoinForm />
    </main>
  );
}
```

- [ ] **Step 7: 提交**

```bash
git add web/lib/join.ts web/lib/__tests__/join.test.ts web/components/JoinForm.tsx web/app/page.tsx && git commit -m "feat: join form with validation"
```

---

## Task 7: 字幕渲染（CaptionList + CaptionPanel）与房间页

**Files:**
- Create: `web/components/CaptionList.tsx`、`web/components/CaptionPanel.tsx`、`web/app/rooms/[room]/page.tsx`
- Test: `web/components/__tests__/CaptionList.test.tsx`

- [ ] **Step 1: 写失败测试（纯展示组件）**

Create `web/components/__tests__/CaptionList.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaptionList } from "@/components/CaptionList";
import type { CaptionStore } from "@/lib/captionStore";

const store: CaptionStore = {
  finals: [
    {
      type: "final", id: "s1", sid: "A", speaker: "Tang",
      srcLang: "zh", original: "你好", tgtLang: "ja", translation: "こんにちは", ts: 1,
    },
  ],
  interims: { B: { type: "interim", sid: "B", speaker: "Sato", original: "ええと…" } },
};

describe("CaptionList", () => {
  it("renders a finalized line with original and translation", () => {
    render(<CaptionList store={store} />);
    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.getByText("Tang")).toBeInTheDocument();
  });

  it("renders an interim line for the live speaker", () => {
    render(<CaptionList store={store} />);
    expect(screen.getByText("ええと…")).toBeInTheDocument();
    expect(screen.getByTestId("interim")).toHaveAttribute("data-sid", "B");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd web && npx vitest run components/__tests__/CaptionList.test.tsx`
Expected: FAIL（`CaptionList` 不存在）。

- [ ] **Step 3: 实现纯展示组件**

Create `web/components/CaptionList.tsx`:
```tsx
import type { CaptionStore } from "@/lib/captionStore";

export function CaptionList({ store }: { store: CaptionStore }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {store.finals.map((f) => (
        <div key={f.id} data-testid="final" data-sid={f.sid} style={{ borderBottom: "1px solid #eee", paddingBottom: 8 }}>
          <strong>{f.speaker}</strong>
          <p style={{ margin: "4px 0" }}>{f.original}</p>
          <p style={{ margin: 0, color: "#2563eb" }}>{f.translation}</p>
        </div>
      ))}
      {Object.values(store.interims).map((i) => (
        <div key={`interim-${i.sid}`} data-testid="interim" data-sid={i.sid} style={{ opacity: 0.5 }}>
          <strong>{i.speaker}</strong>
          <p style={{ margin: "4px 0" }}>{i.original}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd web && npx vitest run components/__tests__/CaptionList.test.tsx`
Expected: PASS（2 个测试）。

- [ ] **Step 5: 写 CaptionPanel 容器（接 data channel）**

Create `web/components/CaptionPanel.tsx`:
```tsx
"use client";
import { useEffect, useReducer } from "react";
import { useDataChannel } from "@livekit/components-react";
import { parseCaption } from "@/lib/captions";
import { captionReducer, emptyStore } from "@/lib/captionStore";
import { CaptionList } from "./CaptionList";

export function CaptionPanel() {
  const [store, dispatch] = useReducer(captionReducer, emptyStore);
  const { message } = useDataChannel("captions");

  useEffect(() => {
    if (!message) return;
    const c = parseCaption(message.payload);
    if (c) dispatch(c);
  }, [message]);

  return <CaptionList store={store} />;
}
```

- [ ] **Step 6: 写房间页（取 token → 连 LiveKit）**

Create `web/app/rooms/[room]/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { CaptionPanel } from "@/components/CaptionPanel";

export default function RoomPage() {
  const params = useParams<{ room: string }>();
  const search = useSearchParams();
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        room: params.room,
        name: search.get("name") ?? "",
        spokenLang: search.get("lang") ?? "",
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "获取 token 失败");
        setConn({ token: data.token, url: data.url });
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [params.room, search]);

  if (error) return <main style={{ padding: 32, color: "crimson" }}>连接失败：{error}</main>;
  if (!conn) return <main style={{ padding: 32 }}>正在连接…</main>;

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
      <main style={{ padding: 32 }}>
        <h2>房间：{params.room}</h2>
        <CaptionPanel />
      </main>
    </LiveKitRoom>
  );
}
```

- [ ] **Step 7: 提交**

```bash
git add web/components web/app/rooms && git commit -m "feat: caption rendering and LiveKit room page"
```

---

## Task 8: Agent 翻译模块（translate.py）

**Files:**
- Create: `agent/translate.py`
- Test: `agent/tests/test_translate.py`

- [ ] **Step 1: 写失败测试**

Create `agent/tests/test_translate.py`:
```python
import pytest
from translate import Translator, TranslationError, other_lang


class FakeClient:
    def __init__(self, reply="  訳文  ", raises=False):
        self.reply = reply
        self.raises = raises
        self.last_prompt = None

    def generate(self, model, prompt):
        self.last_prompt = prompt
        if self.raises:
            raise RuntimeError("boom")
        return self.reply


def test_other_lang():
    assert other_lang("zh") == "ja"
    assert other_lang("ja") == "zh"


def test_translate_strips_output_and_builds_prompt():
    client = FakeClient(reply="  こんにちは  ")
    t = Translator(client)
    out = t.translate("你好", "zh", "ja")
    assert out == "こんにちは"
    assert "Chinese" in client.last_prompt and "Japanese" in client.last_prompt
    assert "你好" in client.last_prompt


def test_empty_text_returns_empty_without_calling_model():
    client = FakeClient()
    t = Translator(client)
    assert t.translate("   ", "zh", "ja") == ""
    assert client.last_prompt is None


def test_failure_raises_translation_error_with_original():
    client = FakeClient(raises=True)
    t = Translator(client)
    with pytest.raises(TranslationError) as ei:
        t.translate("你好", "zh", "ja")
    assert ei.value.original == "你好"
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd agent && pytest tests/test_translate.py -q`
Expected: FAIL（`translate` 模块不存在）。

- [ ] **Step 3: 实现翻译模块**

Create `agent/translate.py`:
```python
from __future__ import annotations

import logging
from typing import Protocol

logger = logging.getLogger(__name__)

LANG_NAMES = {"zh": "Chinese (Simplified)", "ja": "Japanese"}


def other_lang(lang: str) -> str:
    return "ja" if lang == "zh" else "zh"


class TranslationError(Exception):
    def __init__(self, original: str) -> None:
        super().__init__("translation failed")
        self.original = original


class GenAIClient(Protocol):
    def generate(self, model: str, prompt: str) -> str: ...


class Translator:
    def __init__(self, client: GenAIClient, model: str = "gemini-2.5-flash") -> None:
        self._client = client
        self._model = model

    def translate(self, text: str, src: str, tgt: str) -> str:
        if not text.strip():
            return ""
        prompt = (
            f"Translate the following {LANG_NAMES[src]} text into {LANG_NAMES[tgt]}. "
            f"Output only the translation, with no quotes or explanations.\n\n{text}"
        )
        try:
            out = self._client.generate(self._model, prompt)
        except Exception as exc:  # noqa: BLE001
            logger.exception("translation failed")
            raise TranslationError(text) from exc
        return out.strip()


class GeminiClient:
    """Thin adapter over google-genai implementing GenAIClient."""

    def __init__(self, api_key: str) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)

    def generate(self, model: str, prompt: str) -> str:
        resp = self._client.models.generate_content(model=model, contents=prompt)
        return resp.text or ""
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd agent && pytest tests/test_translate.py -q`
Expected: PASS（4 个测试）。

- [ ] **Step 5: 提交**

```bash
git add agent/translate.py agent/tests/test_translate.py && git commit -m "feat: agent translation module with Gemini adapter"
```

---

## Task 9: Agent 字幕构造（captions.py）

**Files:**
- Create: `agent/captions.py`
- Test: `agent/tests/test_captions.py`

- [ ] **Step 1: 写失败测试**

Create `agent/tests/test_captions.py`:
```python
import json
from captions import build_interim, build_final


def test_build_interim_matches_protocol():
    data = json.loads(build_interim("PA_x", "Tang", "你…").decode("utf-8"))
    assert data == {"type": "interim", "sid": "PA_x", "speaker": "Tang", "original": "你…"}


def test_build_final_matches_protocol_and_keeps_cjk():
    raw = build_final(
        id="seg1", sid="PA_x", speaker="Tang",
        src_lang="zh", original="你好", tgt_lang="ja",
        translation="こんにちは", ts=1736668800000,
    )
    # CJK kept as-is, not \uXXXX escaped
    assert "こんにちは".encode("utf-8") in raw
    data = json.loads(raw.decode("utf-8"))
    assert data == {
        "type": "final", "id": "seg1", "sid": "PA_x", "speaker": "Tang",
        "srcLang": "zh", "original": "你好", "tgtLang": "ja",
        "translation": "こんにちは", "ts": 1736668800000,
    }
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd agent && pytest tests/test_captions.py -q`
Expected: FAIL（`captions` 模块不存在）。

- [ ] **Step 3: 实现字幕构造**

Create `agent/captions.py`:
```python
from __future__ import annotations

import json


def build_interim(sid: str, speaker: str, original: str) -> bytes:
    return json.dumps(
        {"type": "interim", "sid": sid, "speaker": speaker, "original": original},
        ensure_ascii=False,
    ).encode("utf-8")


def build_final(
    *,
    id: str,
    sid: str,
    speaker: str,
    src_lang: str,
    original: str,
    tgt_lang: str,
    translation: str,
    ts: int,
) -> bytes:
    return json.dumps(
        {
            "type": "final",
            "id": id,
            "sid": sid,
            "speaker": speaker,
            "srcLang": src_lang,
            "original": original,
            "tgtLang": tgt_lang,
            "translation": translation,
            "ts": ts,
        },
        ensure_ascii=False,
    ).encode("utf-8")
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd agent && pytest tests/test_captions.py -q`
Expected: PASS（2 个测试）。

- [ ] **Step 5: 提交**

```bash
git add agent/captions.py agent/tests/test_captions.py && git commit -m "feat: agent caption payload builders matching protocol"
```

---

## 计划修订（2026-06-15）：回到每人一台设备/麦克风

2026-06-12 的单麦克风声纹分离路线已废弃。当前产品方向贴近 Zoom 实时翻译：每位参与者用自己的浏览器设备加入会议并发布独立 LiveKit 音轨，后台 Agent 订阅每个参与者音轨，`sid` 直接使用 LiveKit participant identity，`speaker` 使用参与者显示名。Deepgram 只负责单人音轨 ASR，不再负责说话人分离。

---

## 历史修订（2026-06-12，已废弃）：改用 Deepgram diarization 区分说话人

方向变更：场景改为「**一台设备一个麦克风收多人**」，在单条音轨内按声纹区分说话人（匿名「说话人N」），每台设备基本单一语种。说话人身份**不再**用 LiveKit 参与者，而是 Deepgram diarization 给出的说话人编号。
- `sid` = `参与者identity#说话人序号`；`speaker` = `设备名 · 说话人N`。**前端协议/UI 不变**（仍按 `sid` 分组、显示 `speaker`）。
- 实现：livekit-agents 的 Deepgram 插件若不暴露逐词 `speaker_id`，则直接用 Deepgram Python SDK 建流式连接拿 diarization 标签。
- 原 Task 10 拆为 **10a**（纯逻辑 diarize.py，TDD）+ **10b**（transcriber 胶水）。

### Task 10a: 说话人标签/分组纯逻辑（diarize.py）

**Files:** Create `agent/diarize.py`、Test `agent/tests/test_diarize.py`

- [ ] Step 1（失败测试）Create `agent/tests/test_diarize.py`:
```python
from diarize import speaker_sid, speaker_label


def test_speaker_sid_combines_identity_and_index():
    assert speaker_sid("tang-abc", 0) == "tang-abc#0"
    assert speaker_sid("tang-abc", 2) == "tang-abc#2"


def test_speaker_label_is_one_based_with_device_name():
    assert speaker_label("会议室A", 0) == "会议室A · 说话人1"
    assert speaker_label("会议室A", 1) == "会议室A · 说话人2"
```
- [ ] Step 2 运行 `cd agent && uv run pytest tests/test_diarize.py -q` → FAIL。
- [ ] Step 3（实现）Create `agent/diarize.py`:
```python
from __future__ import annotations


def speaker_sid(identity: str, speaker: int) -> str:
    return f"{identity}#{speaker}"


def speaker_label(device_name: str, speaker: int) -> str:
    return f"{device_name} · 说话人{speaker + 1}"
```
- [ ] Step 4 运行测试 → PASS（2）。
- [ ] Step 5 提交 `feat: agent diarization speaker label/sid helpers`

### Task 10b: 转录主流程（transcriber.py，带 diarization）

> 集成胶水，无单测；闭环 = 静态导入 + 对照已装 SDK 的 API 存在性核对（真实 E2E 在 Task 12，需凭据）。**已装 livekit-agents 1.6.0 / livekit(rtc) 1.1.8。** 下方"参考代码"是**未带 diarization 的旧稿，仅作起点**；10b 必须在其基础上加 diarization：①Deepgram 开 `diarize=True`；②从结果取说话人编号；③用 `diarize.speaker_sid/speaker_label` 构造 `sid`/`speaker`；④若 livekit 插件不暴露 `speaker_id`，改用 Deepgram Python SDK 直连（requirements 增加 `deepgram-sdk`）。

**Files:**
- Create: `agent/transcriber.py`（参考下方旧稿 + 上述 diarization 改造）

- [ ] **Step 1: 写转录入口**

Create `agent/transcriber.py`:
```python
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.plugins import deepgram

from captions import build_final, build_interim
from translate import GeminiClient, TranslationError, Translator, other_lang

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcriber")

DEEPGRAM_LANG = {"zh": "zh", "ja": "ja"}


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)
    translator = Translator(
        GeminiClient(os.environ["GOOGLE_API_KEY"]),
        model=os.environ.get("TRANSLATE_MODEL", "gemini-2.5-flash"),
    )

    async def transcribe_track(track: rtc.Track, participant: rtc.RemoteParticipant):
        spoken = participant.attributes.get("spoken_lang", "zh")
        if spoken not in DEEPGRAM_LANG:
            spoken = "zh"
        tgt = other_lang(spoken)
        speaker = participant.name or participant.identity

        stt = deepgram.STT(model="nova-2", language=DEEPGRAM_LANG[spoken], interim_results=True)
        stt_stream = stt.stream()
        audio_stream = rtc.AudioStream(track)

        async def pump_audio():
            async for ev in audio_stream:
                stt_stream.push_frame(ev.frame)
            await stt_stream.aclose()

        pump = asyncio.create_task(pump_audio())
        try:
            async for ev in stt_stream:
                if ev.type == agents.stt.SpeechEventType.INTERIM_TRANSCRIPT:
                    text = ev.alternatives[0].text
                    if text:
                        await ctx.room.local_participant.publish_data(
                            build_interim(participant.sid, speaker, text),
                            reliable=True,
                            topic="captions",
                        )
                elif ev.type == agents.stt.SpeechEventType.FINAL_TRANSCRIPT:
                    text = ev.alternatives[0].text
                    if not text:
                        continue
                    try:
                        translation = await asyncio.to_thread(translator.translate, text, spoken, tgt)
                    except TranslationError:
                        translation = "(翻译失败)"
                    await ctx.room.local_participant.publish_data(
                        build_final(
                            id=str(uuid.uuid4()),
                            sid=participant.sid,
                            speaker=speaker,
                            src_lang=spoken,
                            original=text,
                            tgt_lang=tgt,
                            translation=translation,
                            ts=int(time.time() * 1000),
                        ),
                        reliable=True,
                        topic="captions",
                    )
        finally:
            pump.cancel()

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.create_task(transcribe_track(track, participant))


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
```

- [ ] **Step 2: 静态导入自检**

Run: `cd agent && uv run python -c "import transcriber"`
Expected: 无 ImportError（依赖已装齐）。**已装版本为 livekit-agents 1.6.0 / livekit(rtc) 1.1.8**——本任务的示例代码按通用 API 编写，务必对照 1.6.0 实际 API 校验事件类型常量（如 STT 事件枚举）、`AudioStream` 用法与 `publish_data` 签名，按实际版本修正后再跑。

- [ ] **Step 3: 提交**

```bash
git add agent/transcriber.py && git commit -m "feat: multi-participant Deepgram transcription + translation worker"
```

---

## Task 11: 容器化 Agent（Dockerfile + docker-compose）

> 让常驻 worker 跑在容器里，绕开本机 Python 版本、贴近部署。Agent 只对外发起连接（LiveKit Cloud / Deepgram / Gemini），无需暴露入站端口。

**Files:**
- Create: `agent/Dockerfile`、`agent/.dockerignore`、`docker-compose.yml`（仓库根）

- [ ] **Step 1: 写 .dockerignore**

Create `agent/.dockerignore`:
```
.venv/
__pycache__/
*.pyc
.env
tests/
```

- [ ] **Step 2: 写 Dockerfile**

Create `agent/Dockerfile`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "transcriber.py", "start"]
```

- [ ] **Step 3: 写 docker-compose.yml（仓库根）**

Create `docker-compose.yml`:
```yaml
services:
  transcriber:
    build: ./agent
    env_file: ./agent/.env
    restart: unless-stopped
```

- [ ] **Step 4: 构建镜像（验证）**

Run: `docker compose build`
Expected: 镜像构建成功（pip 装齐 livekit-agents 等依赖）。注意：worker 真正注册需要有效的 `agent/.env` 凭据，那一步在 Task 12 端到端验证里做；本步只验证镜像能构建。

- [ ] **Step 5: 提交**

```bash
git add agent/Dockerfile agent/.dockerignore docker-compose.yml && git commit -m "feat: containerize transcriber agent"
```

---

## Task 12: README、环境样例与端到端手动验证

**Files:**
- Create: `web/.env.local.example`、`README.md`

- [ ] **Step 1: 写前端环境样例**

Create `web/.env.local.example`:
```
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

- [ ] **Step 2: 写 README**

Create `README.md`:
````markdown
# 实时双语会议字幕（中 ↔ 日）

各参与者用浏览器麦克风远程入会，后台 Agent 实时转写每个人的语音并翻译成对方语言，网页按「说话人 + 原文 + 译文」显示双语字幕。

## 准备凭据
- LiveKit Cloud 项目：URL（wss）、API Key、API Secret
- Deepgram API Key
- Google Gemini API Key

## 启动前端
```bash
cd web
cp .env.local.example .env.local   # 填入 LiveKit 凭据
npm install
npm run dev                        # http://localhost:3000
```

## 启动转录 Agent（Docker）
```bash
cp agent/.env.example agent/.env   # 填入 LiveKit / Deepgram / Gemini 凭据
docker compose up --build          # 构建并启动 worker，自动注册并加入房间
```

## 测试
- 前端：`cd web && npm test`
- Agent（本机 uv 环境，Python 3.12）：`cd agent && uv run pytest -q`

> 本机系统 Python 为 3.9，过旧；Agent 的本地操作统一经由已安装的 `uv`（`uv venv --python 3.12` 已创建 `agent/.venv`）。常驻 worker 通过 Docker 运行，无需本机 Python。
````

- [ ] **Step 3: 端到端手动验证**

1. 启动前端与 Agent（见上）。
2. 浏览器开两个标签都进入同一房间名：A 标签选「我说中文」，B 标签选「日本語」。
3. 允许麦克风权限。在 A 标签说一句中文。
   - **预期**：A 说话时先出现灰色半句（interim），断句后定稿为「Tang：你好 / こんにちは」双语行，两个标签都能看到。
4. 在 B 标签说一句日语。
   - **预期**：出现「(B 的名字)：日语原文 / 中文译文」，归到 B 名下。
5. 译文出现延迟目标在 1~2 秒内。

- [ ] **Step 4: 提交**

```bash
git add README.md web/.env.local.example && git commit -m "docs: setup guide and env examples"
```

---

## 计划修订（2026-06-12）：UI 框架切换到 shadcn/ui

用户要求前端 UI 改用 shadcn/ui（基于 Radix + Tailwind）。脚手架当初用了 `--no-tailwind`，需补 Tailwind + shadcn init。以下三个修订任务在 Task 7 之后、Task 8 之前执行。**所有非视觉逻辑（validateJoin、captions 协议、reducer、token 路由、数据流）保持不变，现有测试必须保持全绿**——重构只换外观；CaptionList 的 `data-testid`/`data-sid`/文本必须保留，否则组件测试会断。

> 另：Task 7 代码质量审查发现的 Important 问题（`useDataChannel` 只暴露最新消息、React 批处理下会丢 data 消息）已修复——`CaptionPanel` 改用 `useDataChannel("captions", onMessage)` 回调，每条消息同步派发。

### Task A1: 初始化 Tailwind + shadcn/ui

**Files:** 由 shadcn 生成（`components.json`、`app/globals.css` 更新、`lib/utils.ts`、Tailwind 配置、`components/ui/*`）

- [ ] Step 1: `cd web && npx shadcn@latest init`，选默认（CSS variables = yes，base color 选 neutral/slate）。若 Tailwind 未装，让其自动装 Tailwind v4。
- [ ] Step 2: 添加组件：`npx shadcn@latest add button input label select card badge`
- [ ] Step 3: 验证 `npx tsc --noEmit` 干净、`npm test` 仍全绿。
- [ ] Step 4: 提交 `feat: set up Tailwind + shadcn/ui`

### Task A2: JoinForm 改用 shadcn 组件

**Files:** Modify `web/components/JoinForm.tsx`（仅外观；不动 `lib/join.ts` 及其测试）

- [ ] 用 shadcn `Card`、`Label`+`Input`、`Select`（Radix）、`Button` 重写表单外观。提交逻辑、`validateJoin` 调用、路由跳转、错误显示保持不变。
- [ ] 验证 `npm test`（join 逻辑测试不变全绿）+ `npx tsc --noEmit`。
- [ ] 提交 `feat: restyle join form with shadcn/ui`

### Task A3: CaptionList + 房间页改用 shadcn

**Files:** Modify `web/components/CaptionList.tsx`、`web/app/rooms/[room]/page.tsx`（不动 CaptionPanel 逻辑）

- [ ] CaptionList：用 Tailwind + shadcn `Badge`（发言人）/`Card`（气泡）重排版，译文用强调色。**必须保留** `data-testid="final"`、`data-testid="interim"`、`data-sid`，以及 speaker/original/translation 文本，确保 `CaptionList.test.tsx` 2/2 仍过。
- [ ] 房间页：用 shadcn 容器/Card 美化布局与加载/错误态；token 获取、Suspense 拆分、LiveKitRoom 接线保持不变。
- [ ] 验证 `npm test`（CaptionList 2/2）+ `npx tsc --noEmit`。
- [ ] 提交 `feat: restyle captions + room page with shadcn/ui`

---

## 自检备注（已核对）

- **协议一致性**：`web/lib/captions.ts`（parse）、`web/components/CaptionList.tsx`（render）、`agent/captions.py`（build）三处字段名一致：`type/id/sid/speaker/srcLang/original/tgtLang/translation/ts`。
- **语言映射**：`spoken_lang` 属性 → Deepgram `language` → 翻译目标 `other_lang()`，zh↔ja 双向闭环。
- **错误兜底**：翻译失败 → `(翻译失败)` 占位，不阻塞原文上屏（transcriber.py Task 10）。
- **风险点**（实现时留意，按已装 SDK 版本微调，不改架构）：
  1. `livekit-server-sdk` 是否把 `attributes` 写进 JWT（Task 5 已给 metadata 兜底方案）。
  2. `livekit-agents` 的 STT 事件类型常量名与 `publish_data` 签名（Task 10 静态导入自检会暴露）。
  3. Deepgram 中文 language code（`zh` 与 `zh-CN` 视模型而定）。

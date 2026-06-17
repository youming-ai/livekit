# LiveKit 双语实时字幕

一款基于 LiveKit 的实时会议字幕工具，支持中文 ↔ 日语双向翻译。每位参会者从**各自的设备**加入同一个房间，选择自己所说的语言（中文或日语）并发布麦克风音频。后端 Agent 为每条音轨独立调用 Deepgram 进行流式转录，按 LiveKit 参会者身份归属说话人，再通过 Google Gemini 将每条话语翻译成另一门语言，最终以双语字幕的形式实时呈现在每个人的浏览器中。

---

## 架构

- **web/**：TanStack Start（基于 Vite）+ shadcn/ui 前端。提供两步加入流程（先选本人语言 中/日，再填房间名与昵称），连接 LiveKit 发布麦克风音频，并按发言人分组渲染双语字幕。
- **agent/**：Python `livekit-agents` Worker（通过 Docker 运行）。订阅房间内每位参会者的音轨，按该参会者声明的语言调用 Deepgram 流式转录，再交由 Gemini 翻译，最终通过 LiveKit 数据通道将字幕推送给前端。
- **LiveKit Cloud**：承担信令与媒体中转，前端与 Agent 均连接同一个 LiveKit 项目。

### 数据流

1. 前端选择语言、填写房间与昵称后，调用 TanStack Start 服务端函数（server function）签发一个 LiveKit JWT；token 中写入参会者昵称与 `spoken_lang` 属性。
2. 浏览器以该 token 连接房间并发布麦克风音频。
3. Agent 监听 `track_subscribed`，对每条音轨读取 `spoken_lang`，用对应语言做 Deepgram 转录（先 interim 预览、后 final 定稿）。
4. 每条 final 文本经 Gemini 翻译成另一门语言，连同原文一起通过数据通道（topic `captions`）广播。
5. 前端按发言人分组展示双语字幕，同一发言人保持稳定的颜色标识。

---

## 准备凭据

在开始之前，请先获取以下三项服务的凭据：

| 服务 | 获取地址 |
|------|---------|
| LiveKit Cloud（URL + API Key + API Secret） | https://cloud.livekit.io |
| Deepgram API Key | https://console.deepgram.com |
| Google Gemini API Key | https://aistudio.google.com/app/apikey |

---

## 启动前端

> 前端基于 TanStack Start（RC 版）。

```bash
cd web
cp .env.local.example .env.local   # 填入 LiveKit 凭据
npm install
npm run dev                        # 浏览器访问 http://localhost:3000
```

`web/.env.local` 需填写：

```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://your-project.livekit.cloud
```

---

## 启动转录 Agent（Docker）

```bash
cp agent/.env.example agent/.env   # 填入 LiveKit / Deepgram / Gemini 凭据
docker compose up --build
```

`agent/.env` 需填写：

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
DEEPGRAM_API_KEY=...
GOOGLE_API_KEY=...
TRANSLATE_MODEL=gemini-2.5-flash
```

---

## 测试

### 前端（Vitest）

```bash
cd web && npm test
```

### Agent（Python 3.12）

```bash
cd agent && uv run pytest -q
```

> **说明**：Agent 的测试需要 Python 3.12。若本机 Python 版本过低，推荐用 [uv](https://github.com/astral-sh/uv) 管理虚拟环境：
> 首次运行 `uv venv --python 3.12`（生成 `agent/.venv`），之后所有 `uv run` 命令会自动使用该环境。
> Agent Worker 本身通过 Docker 运行，不依赖本机 Python 版本。

---

## 端到端验证（手动，需先填好凭据）

1. 按上述步骤分别启动前端（`npm run dev`）和 Agent（`docker compose up --build`），确认两端均无报错。
2. 在浏览器打开 http://localhost:3000，先选择「我说中文」，再填写房间名与昵称，点击加入，并在弹窗中允许麦克风访问。
3. 用另一台设备（或另一个浏览器标签）打开同一地址，选择「私は日本語を話します」，填入**相同的房间名**和另一个昵称加入。
4. 两端分别用各自的语言对着麦克风说话。
5. **预期结果**：
   - 字幕区域按发言人分组，每条字幕标注对应参会者的昵称。
   - 每条字幕同时显示原文与译文（中文发言显示日语译文，日语发言显示中文译文）。
   - 延迟约 1～2 秒；先出现灰色 interim（半句实时预览），断句后切换为最终定稿文字。

---

## 说明与限制

- **每台设备一种语言**：每位参会者在加入时声明自己所说的语言（中文或日语），Agent 据此选择转录语言。若同一麦克风混入两种语言，转录与翻译准确率会下降；建议不同语言的参会者各自用独立设备接入。
- **按参会者归属说话人**：说话人标签来自 LiveKit 参会者的昵称（缺省时回退到参会者 identity），同一发言人在字幕中保持稳定的颜色。

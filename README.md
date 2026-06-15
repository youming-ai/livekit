# LiveKit 双语实时字幕

一款基于 LiveKit 的实时会议字幕工具，支持中文 ↔ 日语双向翻译。**只需一台设备的麦克风**即可同时捕捉多位发言者的声音——Agent 借助 Deepgram 声纹分离（diarization）将不同说话人的语音自动归类为匿名标签（说话人1、说话人2……），在完成本语言转录后，通过 Google Gemini 将每条话语翻译成另一门语言，最终以双语字幕的形式实时呈现在浏览器中。

---

## 架构

- **web/**：Next.js + shadcn/ui 前端。提供加入表单（房间名、昵称、本设备主要语言 中/日），连接 LiveKit 发布麦克风音频，并渲染按说话人分组的双语字幕。
- **agent/**：Python `livekit-agents` Worker（通过 Docker 运行）。订阅房间内每条音轨，按设备语言调用 Deepgram 流式转录（开启 `enable_diarization`），按声纹分组后由 Gemini 翻译，最终通过 LiveKit 数据通道将字幕推送到前端。
- **LiveKit Cloud**：承担信令与媒体中转，前端与 Agent 均连接同一个 LiveKit 项目。

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
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
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

### 前端（Vitest，18 个用例）

```bash
cd web && npm test
```

### Agent（uv，Python 3.12，9 个用例）

```bash
cd agent && uv run pytest -q
```

> **说明**：本机系统 Python 为 3.9，版本过低，Agent 的本地依赖操作通过 [uv](https://github.com/astral-sh/uv) 管理。  
> 首次使用请先建立虚拟环境：`uv venv --python 3.12`（生成 `agent/.venv`），之后所有 `uv run` 命令会自动使用该环境。  
> Agent Worker 本身通过 Docker 运行，不依赖本机 Python 版本。

---

## 端到端验证（手动，需先填好凭据）

1. 按上述步骤分别启动前端（`npm run dev`）和 Agent（`docker compose up --build`），确认两端均无报错。
2. 在浏览器打开 http://localhost:3000，输入房间名与昵称，在语言选项中选择「这边主要说中文」，点击加入，并在弹窗中允许麦克风访问。
3. 让 2～3 人轮流对着**同一个麦克风**说中文。
4. **预期结果**：
   - 字幕区域按声纹自动分组，出现「说话人1」「说话人2」等标签。
   - 每条字幕同时显示中文原文与日语译文。
   - 延迟约 1～2 秒；先出现灰色 interim（半句实时预览），断句后切换为最终定稿文字。
5. （可选）用另一台设备加入同一房间，语言选择「这边主要说日语」，多位日语说话人对着那台设备的麦克风发言 → 该设备名下出现各自的「说話者N」标签，显示日语原文 + 中文译文。

---

## 说明与限制

- **匿名编号**：说话人编号（说话人1/2/3）由声纹分离算法在当次会话内自动生成，不与用户昵称绑定，刷新页面后编号重新计算。
- **单设备单语言**：每台设备对应一种主要语言（中文或日语）。若同一麦克风同时混入中文和日语，转录与翻译准确率会下降；建议不同语言的参会者使用不同设备分别接入。

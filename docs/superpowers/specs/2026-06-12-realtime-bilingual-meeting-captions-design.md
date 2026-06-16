# 实时双语会议字幕系统 — 设计文档

**日期**：2026-06-12
**状态**：已确认，待进入实现计划

## 1. 背景与目标

中文母语者与日本同事远程开会，需要一套网页工具：

- 各参与者用自己设备的浏览器麦克风远程入会
- 实时把每个人的语音转成文字（ASR）
- 把每句话翻译成对方语言（中 ↔ 日）
- 网页上按「谁 + 原文 + 译文」实时滚动显示双语字幕

**说话人区分**（2026-06-15 修订）：场景回到类 Zoom 方式——**每位参与者用自己的设备和麦克风加入**。LiveKit 为每个参与者发布独立音轨，Agent 以参与者 `identity/name` 作为稳定说话人来源；不再依赖单麦克风声纹分离。

### 范围内（In scope）

- 双语实时字幕（中 ↔ 日），不做 TTS 语音同传
- 云 API 实现（LiveKit Cloud + Deepgram + LLM 翻译），不做自托管模型
- 每位参与者独立设备/麦克风入会，按 LiveKit 参与者音轨区分说话人

### 范围外（Out of scope，YAGNI）

- TTS / 语音同传
- 单麦克风收多人后的声纹分离
- 声纹注册/识别
- 自托管 NeMo/Nemotron/本地 LLM
- 会后转录稿导出（本期只做实时字幕；协议预留了 `id`/`ts`，后续可加）

## 2. 选定方案

**方案 A：Deepgram 流式 ASR + LLM 翻译。**

- ASR 与翻译解耦，各用最强：Deepgram 负责低延迟流式转录，LLM 负责高质量中↔日翻译。
- 延迟低、成本可控（ASR 按分钟计费，翻译按 token 计费且只翻最终句）。
- LiveKit 官方提供 `deepgram` 插件，集成成本低。

被否决的备选：B（OpenAI 全家桶，流式中/日断句不如 Deepgram 稳）、C（Gemini Live 一把梭，原文与译文绑定、分轨喂入需自处理，灵活性差）。

## 3. 整体架构

```
┌─────────────────────────┐         ┌──────────────────────┐
│  浏览器 (Next.js 网页)    │         │   LiveKit Cloud       │
│  - 加入页：昵称+母语选择   │  WebRTC │   (房间/SFU)          │
│  - 房间页：发布麦克风音轨   │◄───────►│                      │
│  - 字幕面板：双语滚动显示   │         │                      │
└─────────────────────────┘         └──────────┬───────────┘
            ▲                                    │ 订阅所有人音轨
            │ data channel (字幕 JSON)            ▼
            │                         ┌──────────────────────┐
            └─────────────────────────│  转录 Agent (Python)  │
                                      │  livekit-agents 后台进程│
                                      │  ├ Deepgram 流式 ASR   │
                                      │  └ LLM 翻译 (Gemini/4o)│
                                      └──────────────────────┘
```

### 组件职责

1. **Next.js 网页（前端）**
   - 加入页：填昵称、选「我说中文 / 我说日语」、填房间名。
   - 服务端 API 路由 `/api/token`：用 LiveKit Server SDK 签发入会 token（API key/secret 只留服务端）。
   - 房间页：用 LiveKit React 组件连接房间、发布麦克风、显示参与者；字幕面板监听 data channel 渲染双语字幕。

2. **LiveKit Cloud**：托管房间与音视频转发（免费档足够 demo），无需自运维。

3. **转录 Agent（Python，`livekit-agents`）**：后台 worker 进程，自动派发进房间，订阅每个参与者音轨，跑 Deepgram 流式识别，对每条最终文本调 LLM 翻译，再把「原文+译文」通过 data channel 发回房间。所有云服务 key 只在此进程。

## 4. 语言处理

- 用户在加入页选「我说中文 / 我说日语」→ 写进 LiveKit 参与者属性 `spoken_lang: "zh" | "ja"`。
- Agent 订阅某音轨时读取该参与者的 `spoken_lang`，配置 Deepgram 识别语言；**翻译目标语 = 另一种语言**（zh→ja / ja→zh）。
- 不依赖流式自动语种检测，入会即确定母语，识别与翻译都最稳。

## 5. 数据流（一句话从说出到上屏）

```
1. 用户说话 → 麦克风音轨推到房间
2. Deepgram 吐 interim（半句、会变）
       → Agent 发 {type:"interim", speaker, original}
       → 前端灰色显示"正在说…"
3. Deepgram 吐 final（断句完成的整句原文）
4. Agent 把 final 原文丢给 LLM 翻译成对方语言
5. Agent 发 {type:"final", id, speaker, sid, srcLang, original, tgtLang, translation, ts}
6. 前端把灰色半句替换成定稿双语整句，归到对应说话人名下
```

## 6. 字幕协议

走 LiveKit data channel，topic = `"captions"`。前端用 `useDataChannel("captions")` 接收。

```jsonc
// 实时半句（频繁、可被覆盖）
{ "type": "interim", "speaker": "Tang", "sid": "PA_xxx", "original": "今天我们讨论一下…" }

// 定稿整句（带翻译，前端永久保留）
{
  "type": "final",
  "id": "seg_01H...",        // 唯一段落 id，前端按它去重/替换
  "speaker": "Tang",         // 显示名
  "sid": "tang-abc",         // LiveKit 参与者 identity，前端按它分组到正确的人
  "srcLang": "zh",
  "original": "今天我们讨论一下下个季度的排期。",
  "tgtLang": "ja",
  "translation": "今日は来四半期のスケジュールについて話しましょう。",
  "ts": 1736668800000
}
```

**决策**：原文 + 译文打包进同一条 `final` 消息，而非用 LiveKit 内置 transcription 通道——两种语言天然对齐，前端渲染单个「双语气泡」最简单，不会错位。

**成本控制**：只对 `final` 句子调用翻译 LLM，interim 半句不翻。

## 7. 错误处理

原则：**原文转录永不被翻译拖垮。**

| 故障点 | 处理策略 |
| --- | --- |
| 麦克风权限被拒 | 前端提示用户去浏览器开权限，不进房间 |
| token 签发失败 | `/api/token` 返回错误码，加入页显示原因 |
| 翻译 LLM 超时/失败 | 重试 1 次；仍失败则只显示原文，译文位置标「(翻译失败)」 |
| Deepgram 流断开 | Agent 针对该音轨重建 STT 会话；LiveKit 自带房间重连 |
| 网络抖动/掉线 | LiveKit 自动重连，前端顶部显示连接状态 |
| 参与者退出 | Agent 关闭对应 STT 会话，释放资源 |

## 8. 测试策略

- **Agent 单元测试**：翻译函数（mock LLM）、字幕 JSON 构造函数、语言映射（zh→ja / ja→zh）。
- **前端组件测试**：给字幕面板喂模拟 `interim`/`final` 事件，验证半句被定稿句替换、按说话人分组、双语渲染。
- **集成测试**：Agent 加入测试房间，推预录中文/日语音频文件当音轨，验证端到端双语字幕。
- **手动 E2E**：两个浏览器标签（一中文一日语）分别说话，确认各自说话人名下出现正确双语字幕，译文延迟目标 1~2 秒内。

## 9. 项目结构

```
LiveKit-demo/
├── web/                          # Next.js 前端
│   ├── app/
│   │   ├── page.tsx              # 加入页（昵称+母语+房间名）
│   │   ├── rooms/[room]/page.tsx # 房间页 + 字幕面板
│   │   └── api/token/route.ts    # 服务端签发 LiveKit token
│   ├── components/
│   │   ├── JoinForm.tsx
│   │   └── CaptionPanel.tsx      # 双语字幕渲染核心
│   ├── lib/captions.ts           # 字幕消息类型 + 解析
│   └── .env.local                # LIVEKIT_URL / API_KEY / API_SECRET（服务端）
├── agent/                        # Python 转录 Agent
│   ├── transcriber.py            # 入口：订阅音轨→STT→翻译→发字幕
│   ├── translate.py              # LLM 翻译封装
│   ├── requirements.txt
│   └── .env                      # DEEPGRAM_API_KEY / LLM key / LIVEKIT 三件套
├── docs/superpowers/specs/       # 设计文档
└── README.md                     # 安装与启动步骤
```

## 10. 密钥与配置

- **LiveKit Cloud**：`LIVEKIT_URL`(wss) + API key + secret。
- **Deepgram**：`DEEPGRAM_API_KEY`。
- **LLM**：Gemini 或 OpenAI key（二选一，Agent 内可配）。
- **安全边界**：浏览器只拿临时入会 token；所有云服务密钥只存在于 Next.js 服务端 API 路由与 Agent 进程，永不下发前端。

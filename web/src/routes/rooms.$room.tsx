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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard: only correct way to defer browser-only LiveKit APIs past SSR
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

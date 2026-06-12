"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { CaptionPanel } from "@/components/CaptionPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function RoomPageInner() {
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

  if (error)
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">连接失败：{error}</p>
          </CardContent>
        </Card>
      </main>
    );

  if (!conn)
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm animate-pulse">正在连接…</p>
          </CardContent>
        </Card>
      </main>
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
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                房间：{params.room}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CaptionPanel />
            </CardContent>
          </Card>
        </div>
      </main>
    </LiveKitRoom>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-8 bg-background">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm animate-pulse">正在加载…</p>
            </CardContent>
          </Card>
        </main>
      }
    >
      <RoomPageInner />
    </Suspense>
  );
}

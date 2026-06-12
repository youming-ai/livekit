"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { CaptionPanel } from "@/components/CaptionPanel";

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

export default function RoomPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32 }}>正在加载…</main>}>
      <RoomPageInner />
    </Suspense>
  );
}

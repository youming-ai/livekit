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

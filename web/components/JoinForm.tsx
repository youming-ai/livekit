"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateJoin } from "@/lib/join";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            双语会议字幕
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">昵称</Label>
              <Input
                id="name"
                placeholder="请输入昵称"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room">房间名</Label>
              <Input
                id="room"
                placeholder="请输入房间名"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>语言</Label>
              <Select
                value={spokenLang}
                onValueChange={(val) => setSpokenLang(val as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">我说中文</SelectItem>
                  <SelectItem value="ja">私は日本語を話す</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full mt-1">
              加入会议
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

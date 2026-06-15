"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateJoin } from "@/lib/join";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Lang = "zh" | "ja";
const LANG_LABEL: Record<Lang, string> = { zh: "我说中文", ja: "我说日文" };

export function JoinForm() {
  const router = useRouter();
  const [step, setStep] = useState<"lang" | "details">("lang");
  const [spokenLang, setSpokenLang] = useState<Lang | "">("");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");

  function chooseLang(lang: Lang) {
    setSpokenLang(lang);
    setError("");
    setStep("details");
  }

  function back() {
    setStep("lang");
    setError("");
  }

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
          <CardTitle className="text-center text-xl font-semibold">
            双语会议字幕
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === "lang" ? (
            <div className="flex flex-col gap-3">
              <p className="text-center text-sm text-muted-foreground">
                请选择你这边主要说的语言
              </p>
              {(["zh", "ja"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => chooseLang(lang)}
                  className="flex flex-col items-center gap-1 rounded-xl border bg-card px-4 py-5 text-center transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="text-lg font-medium">{LANG_LABEL[lang]}</span>
                  <span className="text-xs text-muted-foreground">
                    {lang === "zh" ? "译文显示日语" : "译文显示中文"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={back}
                className="self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                ← {spokenLang ? LANG_LABEL[spokenLang] : ""}（点此重新选择）
              </button>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="room">房间号</Label>
                <Input
                  id="room"
                  placeholder="请输入房间号"
                  value={room}
                  autoFocus
                  onChange={(e) => setRoom(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  placeholder="请输入名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="mt-1 w-full">
                加入会议
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

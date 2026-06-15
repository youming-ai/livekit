"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, ArrowLeft, ArrowRight, Mic, Hash, User2 } from "lucide-react";
import { validateJoin } from "@/lib/join";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Lang = "zh" | "ja";

const LANG_OPTIONS: {
  value: Lang;
  flag: string;
  speak: string;
  hint: string;
  translate: string;
}[] = [
  {
    value: "zh",
    flag: "中",
    speak: "我说中文",
    hint: "中文 → 日语",
    translate: "字幕显示日语译文",
  },
  {
    value: "ja",
    flag: "日",
    speak: "私は日本語を話します",
    hint: "日本語 → 中文",
    translate: "字幕显示中文译文",
  },
];

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
    const q = new URLSearchParams({
      name: r.value.name,
      lang: r.value.spokenLang,
    });
    router.push(`/rooms/${encodeURIComponent(r.value.room)}?${q.toString()}`);
  }

  const selected = LANG_OPTIONS.find((o) => o.value === spokenLang);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-5">
        {/* Brand */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span
            className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden
          >
            <Languages className="size-5" />
          </span>
          <h1 className="text-lg font-semibold">双语会议字幕</h1>
          <p className="text-sm text-muted-foreground">中 ↔ 日 · 实时字幕</p>
        </div>

        <Card className="w-full">
          {step === "lang" ? (
            <>
              <CardHeader>
                <CardTitle className="text-base">选择你这边的语言</CardTitle>
                <CardDescription>
                  我们会把你的发言实时翻译成另一门语言。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => chooseLang(opt.value)}
                    data-testid={`lang-${opt.value}`}
                    className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base font-semibold text-primary"
                      aria-hidden
                    >
                      {opt.flag}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-base font-medium leading-tight">
                        {opt.speak}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {opt.translate}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                ))}
                <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                  <Mic className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>加入后浏览器会请求麦克风权限。</span>
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={back}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" />
                    重新选择
                  </button>
                  {selected && (
                    <Badge variant="secondary" className="gap-1.5">
                      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                      {selected.hint}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base">填写信息后加入</CardTitle>
                <CardDescription>
                  同一房间号的人会进入同一个会议。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="room" className="gap-1.5 text-muted-foreground">
                      <Hash className="size-3" />
                      房间号
                    </Label>
                    <Input
                      id="room"
                      placeholder="例如：team-sync"
                      value={room}
                      autoFocus
                      onChange={(e) => setRoom(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name" className="gap-1.5 text-muted-foreground">
                      <User2 className="size-3" />
                      你的名称
                    </Label>
                    <Input
                      id="name"
                      placeholder="例如：小明"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="mt-1 w-full" size="lg">
                    加入会议
                    <ArrowRight className="size-4" />
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

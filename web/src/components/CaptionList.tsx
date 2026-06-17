"use client";
import { Languages, Mic, MicOff, Quote } from "lucide-react";
import type { CaptionStore } from "@/lib/captionStore";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { speakerColor, speakerInitial } from "@/lib/speakerColor";

const LANG_LABEL: Record<"zh" | "ja", string> = {
  zh: "中文",
  ja: "日本語",
};

export function CaptionList({ store }: { store: CaptionStore }) {
  const hasAny =
    store.finals.length > 0 || Object.keys(store.interims).length > 0;

  if (!hasAny) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="caption-list">
      {store.finals.map((f) => (
        <article
          key={f.id}
          data-testid="final"
          data-sid={f.sid}
          className={cn(
            "group/caption relative flex gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors",
            "hover:border-foreground/15"
          )}
        >
          <Avatar
            className="size-9 text-sm"
            style={{
              backgroundColor: `color-mix(in oklch, ${speakerColor(f.sid)} 22%, var(--card))`,
              color: speakerColor(f.sid),
            }}
            aria-hidden
          >
            {speakerInitial(f.speaker)}
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <header className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold leading-none">
                {f.speaker}
              </span>
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-normal">
                {LANG_LABEL[f.srcLang]}
              </Badge>
              <span
                className="ml-auto text-[10px] tabular-nums text-muted-foreground/80"
                title={new Date(f.ts).toLocaleString()}
              >
                {formatTime(f.ts)}
              </span>
            </header>

            <p
              data-testid="final-original"
              className="text-[15px] leading-relaxed text-foreground"
            >
              {f.original}
            </p>

            <div className="mt-0.5 flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-2.5 py-1.5">
              <Quote
                className="mt-0.5 size-3.5 shrink-0 -scale-x-100 text-muted-foreground"
                aria-hidden
              />
              <p
                data-testid="final-translation"
                className="text-[14px] leading-relaxed text-muted-foreground"
              >
                {f.translation}
              </p>
            </div>
          </div>
        </article>
      ))}

      {Object.values(store.interims).map((i) => (
        <article
          key={`interim-${i.sid}`}
          data-testid="interim"
          data-sid={i.sid}
          className="flex gap-3 rounded-2xl border border-dashed bg-card/60 p-4 opacity-80"
        >
          <Avatar
            className="size-9 text-sm"
            style={{
              backgroundColor: `color-mix(in oklch, ${speakerColor(i.sid)} 18%, var(--card))`,
              color: speakerColor(i.sid),
            }}
            aria-hidden
          >
            {speakerInitial(i.speaker)}
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <header className="flex items-center gap-2">
              <span className="text-sm font-semibold leading-none text-muted-foreground">
                {i.speaker}
              </span>
              <Badge
                variant="outline"
                className="h-5 gap-1 border-dashed px-1.5 text-[10px] font-normal italic text-muted-foreground"
              >
                正在听写…
              </Badge>
            </header>
            <p
              data-testid="interim-original"
              className="animate-pulse text-[15px] leading-relaxed text-muted-foreground"
            >
              {i.original}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="empty"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-14 text-center"
    >
      <div className="relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mic className="size-5" />
        <span className="absolute -right-0.5 -top-0.5 flex size-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
          <span className="relative inline-flex size-3 rounded-full bg-primary" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">正在聆听中…</p>
        <p className="text-xs text-muted-foreground">
          请对麦克风说话，字幕将在识别后出现。
        </p>
      </div>
      <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
        <Languages className="size-3.5" />
        原声与译文会成对出现
      </div>
    </div>
  );
}

/**
 * Indicator badge used by the room header. Kept here to keep
 * the empty/list pieces co-located with the main list.
 */
export function MicMuteIndicator({ muted }: { muted: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        muted
          ? "border-muted bg-muted text-muted-foreground"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      )}
    >
      {muted ? (
        <MicOff className="size-3.5" />
      ) : (
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      )}
      {muted ? "麦克风已关闭" : "正在收听"}
    </span>
  );
}

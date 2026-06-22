import { MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MicMuteIndicator({ muted }: { muted: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        muted
          ? "border-muted bg-muted text-muted-foreground"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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

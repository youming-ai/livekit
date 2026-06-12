import type { CaptionStore } from "@/lib/captionStore";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CaptionList({ store }: { store: CaptionStore }) {
  return (
    <div className="flex flex-col gap-3">
      {store.finals.map((f) => (
        <div
          key={f.id}
          data-testid="final"
          data-sid={f.sid}
          className="rounded-xl bg-card ring-1 ring-foreground/10 px-4 py-3 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{f.speaker}</Badge>
          </div>
          <p className="text-sm text-foreground leading-snug">{f.original}</p>
          <p className="text-sm text-primary font-medium leading-snug">{f.translation}</p>
        </div>
      ))}
      {Object.values(store.interims).map((i) => (
        <div
          key={`interim-${i.sid}`}
          data-testid="interim"
          data-sid={i.sid}
          className={cn(
            "rounded-xl bg-card ring-1 ring-foreground/10 px-4 py-3 flex flex-col gap-1.5",
            "opacity-60"
          )}
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="italic">{i.speaker}</Badge>
          </div>
          <p className="text-sm text-muted-foreground italic animate-pulse leading-snug">{i.original}</p>
        </div>
      ))}
    </div>
  );
}

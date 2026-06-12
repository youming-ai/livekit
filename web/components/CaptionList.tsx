import type { CaptionStore } from "@/lib/captionStore";

export function CaptionList({ store }: { store: CaptionStore }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {store.finals.map((f) => (
        <div key={f.id} data-testid="final" data-sid={f.sid} style={{ borderBottom: "1px solid #eee", paddingBottom: 8 }}>
          <strong>{f.speaker}</strong>
          <p style={{ margin: "4px 0" }}>{f.original}</p>
          <p style={{ margin: 0, color: "#2563eb" }}>{f.translation}</p>
        </div>
      ))}
      {Object.values(store.interims).map((i) => (
        <div key={`interim-${i.sid}`} data-testid="interim" data-sid={i.sid} style={{ opacity: 0.5 }}>
          <strong>{i.speaker}</strong>
          <p style={{ margin: "4px 0" }}>{i.original}</p>
        </div>
      ))}
    </div>
  );
}

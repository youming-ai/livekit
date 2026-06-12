"use client";
import { useReducer } from "react";
import { useDataChannel } from "@livekit/components-react";
import { parseCaption } from "@/lib/captions";
import { captionReducer, emptyStore } from "@/lib/captionStore";
import { CaptionList } from "./CaptionList";

export function CaptionPanel() {
  const [store, dispatch] = useReducer(captionReducer, emptyStore);

  // Dispatch every caption synchronously via the onMessage callback. Reading the
  // hook's `message` (latest-only) would drop messages that arrive in the same
  // React batch — a real risk for a captioning stream.
  useDataChannel("captions", (msg) => {
    const c = parseCaption(msg.payload);
    if (c) dispatch(c);
  });

  return <CaptionList store={store} />;
}

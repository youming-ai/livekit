"use client";
import { useEffect, useReducer } from "react";
import { useDataChannel } from "@livekit/components-react";
import { parseCaption } from "@/lib/captions";
import { captionReducer, emptyStore } from "@/lib/captionStore";
import { CaptionList } from "./CaptionList";

export function CaptionPanel() {
  const [store, dispatch] = useReducer(captionReducer, emptyStore);
  const { message } = useDataChannel("captions");

  useEffect(() => {
    if (!message) return;
    const c = parseCaption(message.payload);
    if (c) dispatch(c);
  }, [message]);

  return <CaptionList store={store} />;
}

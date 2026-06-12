import type { Caption, FinalCaption, InterimCaption } from "./captions";

export interface CaptionStore {
  finals: FinalCaption[];
  interims: Record<string, InterimCaption>;
}

export const emptyStore: CaptionStore = { finals: [], interims: {} };

export function captionReducer(store: CaptionStore, c: Caption): CaptionStore {
  if (c.type === "interim") {
    return { ...store, interims: { ...store.interims, [c.sid]: c } };
  }
  if (store.finals.some((f) => f.id === c.id)) {
    return store;
  }
  const interims = { ...store.interims };
  delete interims[c.sid];
  return { finals: [...store.finals, c], interims };
}

import * as t from "io-ts";

export const TransientFailure = t.interface({
  kind: t.literal("TRANSIENT"),
  reason: t.string
});
export type TransientFailure = t.TypeOf<typeof TransientFailure>;

export const PermanentFailure = t.interface({
  kind: t.literal("PERMANENT"),
  reason: t.string
});
export type PermanentFailure = t.TypeOf<typeof PermanentFailure>;

export const Failure = t.union([TransientFailure, PermanentFailure]);
export type Failure = t.TypeOf<typeof Failure>;

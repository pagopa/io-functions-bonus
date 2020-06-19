import * as t from "io-ts";

const FailureBase = t.partial({
  reason: t.string
});

export const TransientFailure = t.interface({
  kind: t.literal("TRANSIENT")
});
export type TransientFailure = t.TypeOf<typeof TransientFailure>;

export const PermanentFailure = t.interface({
  kind: t.literal("PERMANENT")
});
export type PermanentFailure = t.TypeOf<typeof PermanentFailure>;

export const Failure = t.intersection([
  FailureBase,
  t.union([TransientFailure, PermanentFailure])
]);
export type Failure = t.TypeOf<typeof Failure>;

import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import * as t from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";

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

export const cosmosErrorsToReadableMessage = (errors: CosmosErrors): string => {
  if (errors.kind === "COSMOS_DECODING_ERROR") {
    return errorsToReadableMessages(errors.error).join("/");
  }
  if (errors.kind === "COSMOS_ERROR_RESPONSE") {
    return `body:${errors.error.body}|code:${errors.error.code}`;
  }
  return "COSMOS_EMPTY_RESPONSE";
};

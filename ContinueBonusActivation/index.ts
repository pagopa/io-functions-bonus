import { AzureFunction, Context } from "@azure/functions";
import * as df from "durable-functions";
import { toError } from "fp-ts/lib/Either";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusCode } from "../generated/models/BonusCode";
import { Timestamp } from "../generated/models/Timestamp";
import { OrchestratorInput } from "../StartBonusActivationOrchestrator/handler";
import { trackException } from "../utils/appinsights";
import { Failure, PermanentFailure, TransientFailure } from "../utils/errors";
import { makeStartBonusActivationOrchestratorId } from "../utils/orchestrators";

export const ContinueBonusActivationInput = t.type({
  applicantFiscalCode: FiscalCode,
  bonusId: BonusCode,
  // we need the following value to send notifications
  validBefore: Timestamp
});
export type ContinueBonusActivationInput = t.TypeOf<
  typeof ContinueBonusActivationInput
>;

const permanentDecodeFailure = (errs: t.Errors) =>
  Failure.encode({
    kind: "PERMANENT",
    reason: `Cannot decode input: ${readableReport(errs)}`
  });

const transientOrchestratorError = (err: unknown) =>
  Failure.encode({
    kind: "TRANSIENT",
    reason: `Error starting the orchestrator: ${toError(err).message}`
  });

/**
 * Reads from a queue the tuple (bonusId, fiscalCode)
 * then try to start the orchestrator to activate the bonus.
 */
export const index: AzureFunction = (
  context: Context,
  message: unknown
): Promise<Failure | string> => {
  return fromEither(ContinueBonusActivationInput.decode(message))
    .mapLeft(permanentDecodeFailure)
    .chain(({ bonusId, applicantFiscalCode, validBefore }) =>
      tryCatch(
        () =>
          df.getClient(context).startNew(
            "StartBonusActivationOrchestrator",
            makeStartBonusActivationOrchestratorId(applicantFiscalCode),
            OrchestratorInput.encode({
              applicantFiscalCode,
              bonusId,
              validBefore
            })
          ),
        transientOrchestratorError
      )
    )
    .fold<Failure | string>(err => {
      const error = TransientFailure.is(err)
        ? `ContinueBonusActivation|TRANSIENT_ERROR=${err.reason}`
        : `ContinueBonusActivation|FATAL|PERMANENT_ERROR=${
            err.reason
          }|INPUT=${JSON.stringify(message)}`;
      trackException({
        exception: new Error(error),
        properties: {
          // In case the the input (message from queue) cannot be decoded
          // we mark this as a FATAL error since the lock on user's family won't be relased
          fatal: PermanentFailure.is(err).toString(),
          name: "bonus.activation.orchestrator.start"
        }
      });
      context.log.error(error);
      if (TransientFailure.is(err)) {
        // Trigger a retry in case of temporary failures
        throw new Error(error);
      }
      return err;
    }, t.identity)
    .run();
};

export default index;

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
import { Failure, TransientFailure } from "../utils/errors";
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

/**
 * Reads from a queue the tuple (bonusId, fiscalCode)
 * then try to start the orchestrator to activate the bonus.
 */
export const index: AzureFunction = (
  context: Context,
  message: unknown
): Promise<Failure | string> => {
  return fromEither(ContinueBonusActivationInput.decode(message))
    .mapLeft(errs =>
      Failure.encode({
        kind: "PERMANENT",
        reason: `Cannot decode input: ${readableReport(errs)}`
      })
    )
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
        _ =>
          Failure.encode({
            kind: "TRANSIENT",
            reason: `Error starting the orchestrator: ${toError(_).message}`
          })
      )
    )
    .fold<Failure | string>(err => {
      const error = `ContinueBonusActivation|${err.kind}_ERROR=${err.reason}`;
      trackException({
        exception: new Error(error),
        properties: {
          name: "bonus.activation.orchestrator.start"
        }
      });
      context.log.error(
        `ContinueBonusActivation|${err.kind}_ERROR=${err.reason}`
      );
      if (TransientFailure.is(err)) {
        // Trigger a retry in case of temporary failures
        throw new Error(err.reason);
      }
      return err;
    }, t.identity)
    .run();
};

export default index;

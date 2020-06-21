import { DurableOrchestrationClient } from "durable-functions/lib/src/classes";
import {
  fromEither,
  fromLeft,
  fromPredicate,
  taskEither,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { ContinueEventInput } from "../StartBonusActivationOrchestrator/handler";

import { BonusCode } from "../generated/definitions/BonusCode";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusActivationModel } from "../models/bonus_activation";
import { Failure } from "../utils/errors";
import { makeStartBonusActivationOrchestratorId } from "../utils/orchestrators";

import { toString } from "fp-ts/lib/function";
import * as t from "io-ts";

export const ContinueBonusActivationInput = t.type({
  applicantFiscalCode: FiscalCode,
  bonusId: BonusCode
});

/**
 * Start the orchestrator for a pending (processing)
 * bonus activation identified by its id (code)
 * and the applicant fiscal code.
 */
export function ContinueBonusActivationHandler(
  dfClient: DurableOrchestrationClient,
  bonusActivationModel: BonusActivationModel,
  fiscalCode: FiscalCode,
  bonusId: BonusCode
): TaskEither<Failure, true> {
  return tryCatch(
    () => bonusActivationModel.findBonusActivationForUser(bonusId, fiscalCode),
    err =>
      // Promise rejected or thrown
      Failure.encode({
        kind: "PERMANENT",
        reason: `Query error: ${err}`
      })
  )
    .chain(_ =>
      // CosmosDB query error
      fromEither(_).mapLeft(queryError =>
        Failure.encode({
          kind: "PERMANENT",
          reason: `Query Error ${queryError.code}=${queryError.body}`
        })
      )
    )
    .chain<BonusActivationWithFamilyUID>(maybeBonusActivation =>
      maybeBonusActivation.fold(
        fromLeft(
          Failure.encode({
            kind: "PERMANENT",
            reason: "Bonus activation not found"
          })
        ),
        _ => taskEither.of(_.bonusActivation)
      )
    )
    .chain(
      fromPredicate(
        bonusActivation => bonusActivation.status === "PROCESSING",
        _ =>
          Failure.encode({
            kind: "PERMANENT",
            reason: "Bonus activation status is not PROCESSING"
          })
      )
    )
    .foldTaskEither(
      err => fromLeft(err),
      bonusActivation =>
        tryCatch(
          () =>
            dfClient.raiseEvent(
              makeStartBonusActivationOrchestratorId(
                bonusActivation.applicantFiscalCode
              ),
              "Continue",
              ContinueEventInput.encode({ bonusActivation })
            ),
          err =>
            Failure.encode({
              kind: "TRANSIENT",
              reason: toString(err)
            })
        ).map(_ => true)
    );
}

import { DurableOrchestrationClient } from "durable-functions/lib/src/classes";
import { toError } from "fp-ts/lib/Either";
import {
  fromEither,
  fromLeft,
  fromPredicate,
  taskEither,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { OrchestratorInput } from "../StartBonusActivationOrchestrator/handler";

import { BonusCode } from "../generated/definitions/BonusCode";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusActivationModel } from "../models/bonus_activation";
import { Failure } from "../utils/errors";
import { makeStartBonusActivationOrchestratorId } from "../utils/orchestrators";

import * as t from "io-ts";

export const ContinueBonusActivationInput = t.type({
  applicantFiscalCode: FiscalCode,
  bonusId: BonusCode
});

/**
 * Start a new instance of StartBonusActivationOrchestrator
 *
 * @param client an instance of durable function client
 * @param bonusActivation a record of bonus activation
 * @param fiscalCode the fiscal code of the requesting user. Needed to make a unique id for the orchestrator instance
 *
 * @returns either an internal error or the id of the created orchestrator
 */
const runStartBonusActivationOrchestrator = (
  client: DurableOrchestrationClient,
  bonusActivation: BonusActivationWithFamilyUID,
  fiscalCode: FiscalCode
): TaskEither<Failure, string> =>
  fromEither(OrchestratorInput.decode({ bonusActivation }))
    .mapLeft(err =>
      // validate input here, so we can make the http handler fail too. This shouldn't happen anyway
      Failure.encode({
        kind: "PERMANENT",
        reason: `Error validating orchestrator input: ${readableReport(err)}`
      })
    )
    .chain(orchestratorInput =>
      tryCatch(
        () =>
          client.startNew(
            "StartBonusActivationOrchestrator",
            makeStartBonusActivationOrchestratorId(fiscalCode),
            orchestratorInput
          ),
        _ =>
          Failure.encode({
            kind: "TRANSIENT",
            reason: `Error starting the orchestrator: ${toError(_).message}`
          })
      )
    );

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
): TaskEither<Failure, string> {
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
        runStartBonusActivationOrchestrator(
          dfClient,
          bonusActivation,
          fiscalCode
        )
    );
}

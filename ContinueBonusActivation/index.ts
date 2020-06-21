import { AzureFunction, Context } from "@azure/functions";
import * as df from "durable-functions";
import { fromEither } from "fp-ts/lib/TaskEither";
import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import { documentClient } from "../services/cosmosdb";
import { Failure, TransientFailure } from "../utils/errors";
import {
  ContinueBonusActivationHandler,
  ContinueBonusActivationInput
} from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const bonusActivationCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  BONUS_ACTIVATION_COLLECTION_NAME
);

const bonusActivationModel = new BonusActivationModel(
  documentClient,
  bonusActivationCollectionUrl
);

/**
 * Reads from a queue the tuple (bonusId, fiscalCode)
 * then try to start the orchestrator to activate the bonus.
 */
const index: AzureFunction = (
  context: Context,
  message: unknown
): Promise<Failure | true> => {
  return fromEither(ContinueBonusActivationInput.decode(message))
    .mapLeft(errs =>
      Failure.encode({
        kind: "PERMANENT",
        reason: `Cannot decode input: ${readableReport(errs)}`
      })
    )
    .chain(({ bonusId, applicantFiscalCode }) =>
      ContinueBonusActivationHandler(
        df.getClient(context),
        bonusActivationModel,
        applicantFiscalCode,
        bonusId
      )
    )
    .fold<Failure | true>(err => {
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

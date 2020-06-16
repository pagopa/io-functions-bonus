import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";
import { isLeft } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { SendBonusActivationFailure } from "../SendBonusActivationActivity/handler";
import { toApiBonusVacanzaBase } from "../utils/conversions";
import { retryOptions } from "../utils/retryPolicy";

export const OrchestratorInput = t.interface({
  bonusActivation: BonusActivationWithFamilyUID
});
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const getStartBonusActivationOrchestratorHandler = (
  hmacSecret: NonEmptyString
) =>
  function*(context: IOrchestrationFunctionContext): Generator<TaskSet | Task> {
    const logPrefix = `StartBonusActivationOrchestrator`;
    // Get and decode orchestrator input
    const input = context.df.getInput();
    const errorOrStartBonusActivationOrchestratorInput = OrchestratorInput.decode(
      input
    );
    if (isLeft(errorOrStartBonusActivationOrchestratorInput)) {
      context.log.error(`${logPrefix}|Error decoding input`);
      context.log.verbose(
        `${logPrefix}|Error decoding input|ERROR=${readableReport(
          errorOrStartBonusActivationOrchestratorInput.value
        )}`
      );
      return false;
    }
    const errorOrBonusVacanzaBase = toApiBonusVacanzaBase(
      hmacSecret,
      errorOrStartBonusActivationOrchestratorInput.value.bonusActivation
    );
    if (isLeft(errorOrBonusVacanzaBase)) {
      context.log.error(`${logPrefix}|Error decoding bonus activation request`);
      context.log.verbose(
        `${logPrefix}|Error decoding bonus activation request|ERROR=${readableReport(
          errorOrBonusVacanzaBase.value
        )}`
      );
      return false;
    }

    yield context.df.waitForExternalEvent("ContinueBonusActivation");

    // Send bonus details to ADE rest service
    const undecodedSendBonusActivation = yield context.df.callActivityWithRetry(
      "SendBonusActivationActivity",
      retryOptions,
      errorOrBonusVacanzaBase.value
    );

    if (SendBonusActivationFailure.is(undecodedSendBonusActivation)) {
      yield context.df.callActivity(
        "FailedBonusActivationActivity",
        errorOrStartBonusActivationOrchestratorInput.value
      );
    } else {
      yield context.df.callActivity(
        "SuccessBonusActivationActivity",
        errorOrStartBonusActivationOrchestratorInput.value
      );
    }
    return true;
  };

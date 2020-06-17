import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { addSeconds } from "date-fns";
import * as df from "durable-functions";
import { isSome, none, Option, some } from "fp-ts/lib/Option";
import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import * as t from "io-ts";
import {
  ActivityResult as DeleteEligibilityCheckActivityResult,
  DeleteEligibilityCheckActivityInput
} from "../DeleteEligibilityCheckActivity/handler";
import {
  ActivityResult,
  EligibilityCheckActivityInput
} from "../EligibilityCheckActivity/handler";
import { EligibilityCheck as ApiEligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheckFailure } from "../generated/definitions/EligibilityCheckFailure";
import { EligibilityCheckSuccessConflict } from "../generated/definitions/EligibilityCheckSuccessConflict";
import { EligibilityCheckSuccessEligible } from "../generated/definitions/EligibilityCheckSuccessEligible";
import { EligibilityCheckSuccessIneligible } from "../generated/definitions/EligibilityCheckSuccessIneligible";
import { UpsertEligibilityCheckActivityInput } from "../UpsertEligibilityCheckActivity/handler";
import { toApiEligibilityCheckFromDSU } from "../utils/conversions";
import { MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";
import { ValidateEligibilityCheckActivityInput } from "../ValidateEligibilityCheckActivity/handler";

import { isLeft } from "fp-ts/lib/Either";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { SendMessageActivityInput } from "../SendMessageActivity/handler";

export const OrchestratorInput = FiscalCode;
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

const NOTIFICATION_DELAY_SECONDS = 10;
const logPrefix = "EligibilityCheckOrchestrator";

export const getMessage = (_: ApiEligibilityCheck): Option<MessageContent> => {
  return EligibilityCheckFailure.is(_)
    ? some(MESSAGES.EligibilityCheckFailure())
    : EligibilityCheckSuccessEligible.is(_) && _.dsu_request.has_discrepancies
    ? some(MESSAGES.EligibilityCheckSuccessEligibleWithDiscrepancies())
    : EligibilityCheckSuccessEligible.is(_)
    ? some(MESSAGES.EligibilityCheckSuccessEligible())
    : EligibilityCheckSuccessIneligible.is(_)
    ? some(MESSAGES.EligibilityCheckSuccessIneligible())
    : EligibilityCheckSuccessConflict.is(_)
    ? some(MESSAGES.EligibilityCheckConflict())
    : none;
};

export const handler = function*(
  context: IOrchestrationFunctionContext
): Generator {
  context.df.setCustomStatus("RUNNING");
  const input = context.df.getInput();
  // tslint:disable-next-line: no-let
  let validatedEligibilityCheck: EligibilityCheck;
  // tslint:disable-next-line: no-let
  let eligibilityCheckResponse: ActivityResult;
  try {
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

    const orchestratorInput =
      errorOrStartBonusActivationOrchestratorInput.value;

    const deleteEligibilityCheckResponse = yield context.df.callActivity(
      "DeleteEligibilityCheckActivity",
      DeleteEligibilityCheckActivityInput.encode(orchestratorInput)
    );

    DeleteEligibilityCheckActivityResult.decode(
      deleteEligibilityCheckResponse
    ).map(_ => {
      if (_.kind === "FAILURE") {
        throw new Error(_.reason);
      }
    });

    const undecodedEligibilityCheckResponse = yield context.df.callActivityWithRetry(
      "EligibilityCheckActivity",
      retryOptions,
      EligibilityCheckActivityInput.encode(orchestratorInput)
    );
    eligibilityCheckResponse = ActivityResult.decode(
      undecodedEligibilityCheckResponse
    ).getOrElse({
      kind: "FAILURE",
      reason: "ActivityResult decoding error"
    });

    if (eligibilityCheckResponse.kind !== "SUCCESS") {
      throw new Error(
        `Unexpected response from EligibilityCheckActivity: [${eligibilityCheckResponse.reason}]`
      );
    }
    const eligibilityCheck = toApiEligibilityCheckFromDSU(
      eligibilityCheckResponse.data,
      eligibilityCheckResponse.fiscalCode,
      eligibilityCheckResponse.validBefore
    ).getOrElseL(error => {
      throw new Error(
        `Unexpected response from toApiEligibilityCheckFromDSU: [${readableReport(
          error
        )}]`
      );
    });
    const undecodedValidatedEligibilityCheck = yield context.df.callActivity(
      "ValidateEligibilityCheckActivity",
      ValidateEligibilityCheckActivityInput.encode(eligibilityCheck)
    );
    validatedEligibilityCheck = EligibilityCheck.decode(
      undecodedValidatedEligibilityCheck
    ).getOrElseL(error => {
      throw new Error(`Decoding Error: [${readableReport(error)}]`);
    });

    yield context.df.callActivityWithRetry(
      "UpsertEligibilityCheckActivity",
      retryOptions,
      UpsertEligibilityCheckActivityInput.encode(validatedEligibilityCheck)
    );
  } catch (err) {
    context.log.error("EligibilityCheckOrchestrator|ERROR|%s", err);
    return err;
  } finally {
    context.df.setCustomStatus("COMPLETED");
  }

  // sleep before sending push notification
  // so we can let the get operation stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  // send push notification with eligibility details
  const maybeMessage = getMessage(validatedEligibilityCheck);

  if (isSome(maybeMessage)) {
    yield context.df.callActivityWithRetry(
      "SendMessageActivity",
      retryOptions,
      SendMessageActivityInput.encode({
        content: maybeMessage.value,
        fiscalCode: eligibilityCheckResponse.fiscalCode
      })
    );
  } else {
    context.log.error(
      `EligibilityCheckOrchestrator|ERROR|Cannot decode eligibility check`
    );
    context.log.verbose(
      `EligibilityCheckOrchestrator|ERROR|Cannot decode eligibility check|CF=${eligibilityCheckResponse.fiscalCode}`
    );
  }

  return validatedEligibilityCheck;
};

export const index = df.orchestrator(handler);

import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { addSeconds } from "date-fns";
import * as df from "durable-functions";
import { fromNullable, isSome, none, Option, some } from "fp-ts/lib/Option";
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
import { getMessage, MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";
import { ValidateEligibilityCheckActivityInput } from "../ValidateEligibilityCheckActivity/handler";

import { isLeft } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";
import { trackEvent, trackException } from "../utils/appinsights";
import { toHash } from "../utils/hash";
import { assertNever } from "../utils/types";

export const OrchestratorInput = FiscalCode;
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

const NOTIFICATION_DELAY_SECONDS = 10;

export const getMessageType = (
  _: ApiEligibilityCheck
): Option<keyof typeof MESSAGES> => {
  return EligibilityCheckFailure.is(_)
    ? some("EligibilityCheckFailure")
    : EligibilityCheckSuccessEligible.is(_) && _.dsu_request.has_discrepancies
    ? some("EligibilityCheckSuccessEligibleWithDiscrepancies")
    : EligibilityCheckSuccessEligible.is(_)
    ? some("EligibilityCheckSuccessEligible")
    : EligibilityCheckSuccessIneligible.is(_)
    ? some("EligibilityCheckSuccessIneligible")
    : EligibilityCheckSuccessConflict.is(_)
    ? some("EligibilityCheckConflict")
    : none;
};

export const handler = function*(
  context: IOrchestrationFunctionContext,
  logPrefix: string = "EligibilityCheckOrchestrator"
): Generator {
  context.df.setCustomStatus("RUNNING");
  const input = context.df.getInput();
  // tslint:disable-next-line: no-let
  let validatedEligibilityCheck: EligibilityCheck;
  // tslint:disable-next-line: no-let
  let eligibilityCheckResponse: ActivityResult;
  const errorOrEligibilityCheckOrchestratorInput = OrchestratorInput.decode(
    input
  );
  if (isLeft(errorOrEligibilityCheckOrchestratorInput)) {
    context.log.verbose(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrEligibilityCheckOrchestratorInput.value
      )}`
    );
    trackException({
      exception: new Error(`${logPrefix}|Cannot decode input`),
      properties: {
        // tslint:disable-next-line: no-duplicate-string
        name: "bonus.eligibilitycheck.error"
      }
    });
    return false;
  }

  const orchestratorInput = errorOrEligibilityCheckOrchestratorInput.value;
  const operationId = toHash(orchestratorInput);

  try {
    const deleteEligibilityCheckResponse = yield context.df.callActivityWithRetry(
      "DeleteEligibilityCheckActivity",
      retryOptions,
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
    ).getOrElseL(error => {
      throw new Error(
        `Cannot decode response from INPS: [${readableReport(error)}]`
      );
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
        `Cannot decode ApiEligibilityCheckFromDSU: [${readableReport(error)}]`
      );
    });

    const undecodedValidatedEligibilityCheck = yield context.df.callActivityWithRetry(
      "ValidateEligibilityCheckActivity",
      retryOptions,
      ValidateEligibilityCheckActivityInput.encode(eligibilityCheck)
    );
    validatedEligibilityCheck = EligibilityCheck.decode(
      undecodedValidatedEligibilityCheck
    ).getOrElseL(error => {
      throw new Error(
        `Cannot decode validated EligibilityCheck: [${readableReport(error)}]`
      );
    });

    yield context.df.callActivityWithRetry(
      "UpsertEligibilityCheckActivity",
      retryOptions,
      UpsertEligibilityCheckActivityInput.encode(validatedEligibilityCheck)
    );
  } catch (err) {
    context.log.error(`${logPrefix}|ERROR|${toString(err)}`);
    trackException({
      exception: err,
      properties: {
        id: operationId,
        name: "bonus.eligibilitycheck.error"
      }
    });
    return false;
  } finally {
    context.df.setCustomStatus("COMPLETED");
  }

  trackEvent({
    name: "bonus.eligibilitycheck.success",
    properties: {
      id: operationId,
      status: `${validatedEligibilityCheck.status}`
    }
  });

  // sleep before sending push notification
  // so we can let the get operation stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  trackEvent({
    name: "bonus.eligibilitycheck.timer",
    properties: {
      id: operationId,
      status: `${validatedEligibilityCheck.status}`
    }
  });

  // send push notification with eligibility details
  const maybeMessageType = getMessageType(validatedEligibilityCheck);

  if (isSome(maybeMessageType)) {
    yield context.df.callActivityWithRetry(
      "SendMessageActivity",
      retryOptions,
      SendMessageActivityInput.encode({
        checkProfile: false,
        content: getMessage(
          maybeMessageType.value,
          eligibilityCheckResponse.validBefore
        ),
        fiscalCode: eligibilityCheckResponse.fiscalCode
      })
    );
    trackEvent({
      name: "bonus.eligibilitycheck.message",
      properties: {
        id: operationId,
        type: maybeMessageType.value
      }
    });
  } else {
    trackException({
      exception: new Error(
        `Cannot get message type for eligibility check: ${eligibilityCheckResponse.fiscalCode}`
      ),
      properties: {
        id: operationId,
        name: "bonus.eligibilitycheck.error"
      }
    });
    return false;
  }

  return validatedEligibilityCheck;
};

export const index = df.orchestrator(handler);

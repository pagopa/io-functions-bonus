// tslint:disable: no-any

import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";
import {
  mockOrchestratorCallActivity,
  mockOrchestratorCallActivityWithRetry,
  mockOrchestratorContext,
  mockOrchestratorGetInput
} from "../../__mocks__/durable-functions";
import {
  aBonusId,
  aFamilyUID,
  aFiscalCode,
  aRetrievedBonusActivation
} from "../../__mocks__/mocks";
import { FailedBonusActivationResult } from "../../FailedBonusActivationActivity/handler";
import { GetBonusActivationActivityOutput } from "../../GetBonusActivationActivity/handler";
import { ReleaseFamilyLockActivityResult } from "../../ReleaseFamilyLockActivity/handler";
import {
  SendBonusActivationFailure,
  SendBonusActivationSuccess
} from "../../SendBonusActivationActivity/handler";
import { ActivityResult as SendMessageActivityResult } from "../../SendMessageActivity/handler";
import { SuccessBonusActivationSuccess } from "../../SuccessBonusActivationActivity/handler";
import { trackException } from "../../utils/appinsights";
import { PermanentFailure } from "../../utils/errors";
import { getStartBonusActivationOrchestratorHandler } from "../handler";

const aHmacSecret = Buffer.from("supersecret");

jest.mock("../../utils/appinsights");

const mockGetBonusActivationActivityCall = jest.fn().mockImplementation(() =>
  GetBonusActivationActivityOutput.encode({
    bonusActivation: aRetrievedBonusActivation,
    kind: "SUCCESS"
  })
);

const mockSendBonusActivationActivityCall = jest
  .fn()
  .mockImplementation(() =>
    SendBonusActivationSuccess.encode({ kind: "SUCCESS" })
  );

const mockReleaseFamilyLockActivityCall = jest.fn().mockImplementation(() =>
  ReleaseFamilyLockActivityResult.encode({
    familyUID: aFamilyUID,
    kind: "SUCCESS"
  })
);

const mockSuccessBonusActivationActivityCall = jest
  .fn()
  .mockImplementation(() =>
    SuccessBonusActivationSuccess.encode({
      kind: "SUCCESS"
    })
  );

const mockSendMessageActivityCall = jest.fn().mockImplementation(() =>
  SendMessageActivityResult.encode({
    kind: "SUCCESS"
  })
);

const mockFailedBonusActivationActivityCall = jest.fn().mockImplementation(() =>
  FailedBonusActivationResult.encode({
    kind: "SUCCESS"
  })
);

// A mock implementation proxy for df.callActivity/df.df.callActivityWithRetry that routes each call to the correct mock implentation
const switchMockImplementation = (name: string, ...args: readonly unknown[]) =>
  (name === "GetBonusActivationActivity"
    ? mockGetBonusActivationActivityCall
    : name === "SendBonusActivationActivity"
    ? mockSendBonusActivationActivityCall
    : name === "ReleaseFamilyLockActivity"
    ? mockReleaseFamilyLockActivityCall
    : name === "SuccessBonusActivationActivity"
    ? mockSuccessBonusActivationActivityCall
    : name === "FailedBonusActivationActivity"
    ? mockFailedBonusActivationActivityCall
    : name === "SendMessageActivity"
    ? mockSendMessageActivityCall
    : jest.fn())(name, ...args);

// I assign switchMockImplementation to both because
// I don't want tests to depend on implementation details
// such as which activity is called with retry and which is not
mockOrchestratorCallActivity.mockImplementation(switchMockImplementation);
mockOrchestratorCallActivityWithRetry.mockImplementation(
  switchMockImplementation
);

/**
 * Util function that takes an orchestrator and executes each step until is done
 * @param orch an orchestrator
 *
 * @returns the last value yielded by the orchestrator
 */
const consumeOrchestrator = (orch: any) => {
  // tslint:disable-next-line: no-let
  let prevValue: unknown;
  while (true) {
    const { done, value } = orch.next(prevValue);
    if (done) {
      return value;
    }
    prevValue = value;
  }
};

// just a convenient cast, good for every test case
const context = (mockOrchestratorContext as unknown) as IOrchestrationFunctionContext;

describe("getStartBonusActivationOrchestratorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail on invalid input", () => {
    mockOrchestratorGetInput.mockReturnValueOnce("invalid");

    const result = consumeOrchestrator(
      getStartBonusActivationOrchestratorHandler(aHmacSecret)(context)
    );

    expect(result).toBe(false);
    expect(mockGetBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockSendBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockSendMessageActivityCall).not.toHaveBeenCalled();
    expect(mockSuccessBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockFailedBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockReleaseFamilyLockActivityCall).not.toHaveBeenCalled();
    expect(trackException).toHaveBeenCalled();
  });

  it("should not release the lock when there's an error in reading the current bonus activation", () => {
    mockGetBonusActivationActivityCall.mockReturnValueOnce(
      PermanentFailure.encode({ kind: "PERMANENT", reason: "a bug" })
    );

    mockOrchestratorGetInput.mockReturnValueOnce({
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: new Date()
    });

    const result = consumeOrchestrator(
      getStartBonusActivationOrchestratorHandler(aHmacSecret)(context)
    );

    expect(result).toBe(true);
    expect(mockGetBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockSendMessageActivityCall).not.toHaveBeenCalled();
    expect(mockSuccessBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockFailedBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockReleaseFamilyLockActivityCall).not.toHaveBeenCalled();
    expect(trackException).toHaveBeenCalled();
  });

  it("should not release the lock when bonus activation returns an invalid output", () => {
    mockGetBonusActivationActivityCall.mockReturnValueOnce("invalid output");

    mockOrchestratorGetInput.mockReturnValueOnce({
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: new Date()
    });

    const result = consumeOrchestrator(
      getStartBonusActivationOrchestratorHandler(aHmacSecret)(context)
    );

    expect(result).toBe(true);
    expect(mockGetBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockReleaseFamilyLockActivityCall).not.toHaveBeenCalled();
    expect(mockSuccessBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockFailedBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockReleaseFamilyLockActivityCall).not.toHaveBeenCalled();
    expect(trackException).toHaveBeenCalled();
  });

  it("should release the lock SendBonusActivationActivity fails after all retries", () => {
    mockSendBonusActivationActivityCall.mockImplementationOnce(() => {
      throw new Error("unexpected");
    });

    mockOrchestratorGetInput.mockReturnValueOnce({
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: new Date()
    });

    const result = consumeOrchestrator(
      getStartBonusActivationOrchestratorHandler(aHmacSecret)(context)
    );

    expect(result).toBe(true);
    expect(mockGetBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendMessageActivityCall).toHaveBeenCalled();
    expect(mockSuccessBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockFailedBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockReleaseFamilyLockActivityCall).toHaveBeenCalled();
    expect(trackException).toHaveBeenCalled();
  });

  it("should handle success when ADE activaction succeeds", () => {
    mockSendBonusActivationActivityCall.mockReturnValueOnce(
      SendBonusActivationSuccess.encode({
        kind: "SUCCESS"
      })
    );
    mockOrchestratorGetInput.mockReturnValueOnce({
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: new Date()
    });

    const result = consumeOrchestrator(
      getStartBonusActivationOrchestratorHandler(aHmacSecret)(context)
    );

    expect(result).toBe(true);
    expect(mockGetBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendMessageActivityCall).toHaveBeenCalled();
    expect(mockSuccessBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockFailedBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockReleaseFamilyLockActivityCall).not.toHaveBeenCalled();
    expect(trackException).not.toHaveBeenCalled();
  });

  it("should handle failure when ADE activaction fails", () => {
    mockSendBonusActivationActivityCall.mockReturnValueOnce(
      // any failure kind is fine for this test
      SendBonusActivationFailure.encode({
        kind: "UNHANDLED_FAILURE",
        reason: "a bug"
      })
    );

    mockOrchestratorGetInput.mockReturnValueOnce({
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: new Date()
    });

    const result = consumeOrchestrator(
      getStartBonusActivationOrchestratorHandler(aHmacSecret)(context)
    );

    expect(result).toBe(true);
    expect(mockGetBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockSendMessageActivityCall).toHaveBeenCalled();
    expect(mockSuccessBonusActivationActivityCall).not.toHaveBeenCalled();
    expect(mockFailedBonusActivationActivityCall).toHaveBeenCalled();
    expect(mockReleaseFamilyLockActivityCall).toHaveBeenCalled();
    expect(trackException).not.toHaveBeenCalled();
  });
});

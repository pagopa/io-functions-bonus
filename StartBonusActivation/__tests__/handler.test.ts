// tslint:disable: no-identical-functions

import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { ResponseErrorInternal } from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  context,
  mockGetStatus,
  mockStatusCompleted,
  mockStatusRunning
} from "../../__mocks__/durable-functions";
import {
  aBonusId,
  aEligibilityCheckSuccessEligibleExpired,
  aEligibilityCheckSuccessEligibleValid,
  aEligibilityCheckSuccessIneligible,
  aRetrievedBonusActivation,
  aRetrievedBonusLease
} from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { BonusLeaseModel } from "../../models/bonus_lease";
import { BonusProcessing } from "../../models/bonus_processing";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import { OrchestratorInput } from "../../StartBonusActivationOrchestrator/handler";
import { makeStartEligibilityCheckOrchestratorId } from "../../utils/orchestrators";
import { StartBonusActivationHandler } from "../handler";

const enqueueBonusActivation = jest.fn().mockReturnValue(taskEither.of("foo"));

const queueName = "somequeuename" as NonEmptyString;

// implement temporary mockGetStatus
const simulateOrchestratorIsRunning = (forOrchestratorId: string) => {
  mockGetStatus.mockImplementation(async (orchestratorId: string) =>
    orchestratorId === forOrchestratorId
      ? mockStatusRunning
      : mockStatusCompleted
  );
};

// mockEligibilityCheckModel
const mockEligibilityCheckFind = jest.fn().mockImplementation(async () =>
  // happy path: retrieve a valid eligible check
  right(some(aEligibilityCheckSuccessEligibleValid))
);
const mockEligibilityCheckModel = ({
  find: mockEligibilityCheckFind
} as unknown) as EligibilityCheckModel;

// mockBonusActivationModel
const mockBonusActivationCreate = jest.fn().mockImplementation(async _ => {
  return right(aRetrievedBonusActivation);
});
const mockBonusActivationModel = ({
  create: mockBonusActivationCreate
} as unknown) as BonusActivationModel;

// mockBonusLeaseModel
const mockBonusLeaseCreate = jest.fn().mockImplementation(async _ => {
  return right(aRetrievedBonusLease);
});
const mockBonusLeaseDeleteOneById = jest.fn().mockImplementation(async _ => {
  return right("");
});
const mockBonusLeaseModel = ({
  create: mockBonusLeaseCreate,
  deleteOneById: mockBonusLeaseDeleteOneById
} as unknown) as BonusLeaseModel;

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

// tslint:disable-next-line: no-big-function
describe("StartBonusActivationHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // tslint:disable-next-line: no-object-mutation
    context.bindings = {};
  });

  afterEach(() => {
    // This is the default, happy path behavior
    // I need this because I don't know how many times df.getStatus get called.
    mockGetStatus.mockImplementation(async () => mockStatusCompleted);
  });

  it("should block the user if there's an eligibility check running", async () => {
    simulateOrchestratorIsRunning(
      makeStartEligibilityCheckOrchestratorId(aFiscalCode)
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should notify the user if there's already a bonus activation running", async () => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.processingBonusIdIn = BonusProcessing.encode({
      bonusId: aBonusId,
      id: aFiscalCode
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessAccepted");
    if (response.kind === "IResponseSuccessAccepted") {
      expect(response.payload).toEqual({ id: aBonusId });
    }
  });

  it("should tell if the eligibility check is too old", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ =>
      right(some(aEligibilityCheckSuccessEligibleExpired))
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorGone");
  });

  it("should tell if there's no eligibility check for the current user", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ => right(none));
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should tell if the found eligibility check for the current user is not of type eligible", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ =>
      right(some(aEligibilityCheckSuccessIneligible))
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should return an error if the query for eligibility check fails", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ => {
      throw new Error("quey failed");
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should return an error if the query for eligibility check fails", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ => {
      throw new Error("quey failed");
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should retry bonus code generation if theres already the same code on the db", async () => {
    mockBonusActivationCreate.mockImplementationOnce(async _ =>
      left({
        code: 409
      })
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);
    const input = {
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: aEligibilityCheckSuccessEligibleValid.validBefore
    };
    expect(enqueueBonusActivation).toHaveBeenCalledWith(input);

    // the first attempt failed, so it's called twice
    expect(mockBonusActivationCreate).toHaveBeenCalledTimes(2);
    // called with different bonus codes
    const firstAttemptedCode = mockBonusActivationCreate.mock.calls[0][0].id;
    const secondAttemptedCode = mockBonusActivationCreate.mock.calls[1][0].id;
    expect(firstAttemptedCode).not.toBe(secondAttemptedCode);
    expect(response.kind).toBe("IResponseSuccessRedirectToResource");
  });

  it("should not retry bonus code generation on a non-409 error", async () => {
    mockBonusActivationCreate.mockImplementationOnce(async _ => {
      return left({
        code: 123
      });
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(mockBonusActivationCreate).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should not retry bonus code generation on a generic query error", async () => {
    mockBonusActivationCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(mockBonusActivationCreate).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should return a conflict if there's a lock already for this family", async () => {
    mockBonusLeaseCreate.mockImplementationOnce(async _ => {
      return left({
        code: 409
      });
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorConflict");
  });

  it("should return an internal error if there's a problem while acquiring the lock", async () => {
    mockBonusLeaseCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should relase the lock if the bonus creation fails", async () => {
    mockBonusActivationCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);
    expect(mockBonusLeaseDeleteOneById).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should not relase the lock when fails to acquire the lock", async () => {
    mockBonusLeaseCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    await handler(context, aFiscalCode);

    expect(mockBonusLeaseDeleteOneById).not.toHaveBeenCalled();
  });

  it("should enqueue bonusid in case bonus creation succeed", async () => {
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    const input = {
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: aEligibilityCheckSuccessEligibleValid.validBefore
    };

    expect(enqueueBonusActivation).toHaveBeenCalledWith(input);
    expect(response.kind).toBe("IResponseSuccessRedirectToResource");
  });

  it("should release family lock when message enqueing fail", async () => {
    enqueueBonusActivation.mockReturnValueOnce(
      fromLeft(ResponseErrorInternal("foo"))
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    const input = {
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId,
      validBefore: aEligibilityCheckSuccessEligibleValid.validBefore
    };
    expect(enqueueBonusActivation).toHaveBeenCalledWith(input);

    expect(mockBonusLeaseModel.deleteOneById).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseErrorInternal");
  });
});

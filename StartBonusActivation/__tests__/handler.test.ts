// tslint:disable: no-identical-functions

import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { ResponseErrorInternal } from "italia-ts-commons/lib/responses";
import {
  context,
  mockGetStatus,
  mockStatusCompleted,
  mockStatusRunning
} from "../../__mocks__/durable-functions";
import {
  aBonusId,
  aEligibilityCheckSuccessConflict,
  aEligibilityCheckSuccessEligibleExpired,
  aEligibilityCheckSuccessEligibleValid,
  aEligibilityCheckSuccessIneligible,
  aFiscalCode,
  aRetrievedBonusActivation,
  aRetrievedBonusLease,
  aRetrievedBonusProcessing
} from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { BonusLeaseModel } from "../../models/bonus_lease";
import {
  BonusProcessing,
  BonusProcessingModel
} from "../../models/bonus_processing";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import { makeStartEligibilityCheckOrchestratorId } from "../../utils/orchestrators";
import { StartBonusActivationHandler } from "../handler";

const enqueueBonusActivation = jest.fn().mockReturnValue(taskEither.of("foo"));

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

const mockBonusProcessingCreate = jest.fn().mockImplementation(async _ => {
  return right(aRetrievedBonusProcessing);
});
const mockBonusProcessingFind = jest.fn().mockImplementation(async () =>
  // happy path: retrieve a valid eligible check
  right(none)
);
const mockBonusProcessingModel = ({
  create: mockBonusProcessingCreate,
  find: mockBonusProcessingFind
} as unknown) as BonusProcessingModel;

// tslint:disable-next-line: no-big-function
describe("StartBonusActivationHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // This is the default, happy path behavior
    // I need this because I don't know how many times df.getStatus get called.
    mockGetStatus.mockImplementation(async () => mockStatusCompleted);
  });

  it("should block the user if there is an eligibility check running", async () => {
    simulateOrchestratorIsRunning(
      makeStartEligibilityCheckOrchestratorId(aFiscalCode)
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should notify the user if there is already a bonus activation running", async () => {
    mockBonusProcessingFind.mockImplementationOnce(async () =>
      right(
        some(
          BonusProcessing.encode({
            bonusId: aBonusId,
            id: aFiscalCode
          })
        )
      )
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessAccepted");
    if (response.kind === "IResponseSuccessAccepted") {
      expect(response.payload).toEqual({
        id: aBonusId
      });
    }

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should tell if the eligibility check is too old", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ =>
      right(some(aEligibilityCheckSuccessEligibleExpired))
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorGone");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should tell if there is no eligibility check for the current user", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ => right(none));
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should tell if the found eligibility check for the current user is not of type eligible", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ =>
      right(some(aEligibilityCheckSuccessIneligible))
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should tell if the found eligibility check for the current user is conflict", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ =>
      right(some(aEligibilityCheckSuccessConflict))
    );
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should return an error if the query for eligibility check fails", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(async _ => {
      throw new Error("query failed");
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorInternal");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should retry bonus code generation if there is already the same code on the db", async () => {
    mockBonusActivationCreate.mockImplementationOnce(async _ =>
      left({
        code: 409
      })
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
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
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(mockBonusActivationCreate).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseErrorInternal");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should not retry bonus code generation on a generic query error", async () => {
    mockBonusActivationCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(mockBonusActivationCreate).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseErrorInternal");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should return a conflict if there is a lock already for this family", async () => {
    mockBonusLeaseCreate.mockImplementationOnce(async _ => {
      return left({
        code: 409
      });
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorConflict");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should return an internal error if there is a problem while acquiring the lock", async () => {
    mockBonusLeaseCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorInternal");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should release the lock if the bonus creation fails", async () => {
    mockBonusActivationCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    const response = await handler(context, aFiscalCode);
    expect(mockBonusLeaseDeleteOneById).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseErrorInternal");

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should not relase the lock when fails to acquire the lock", async () => {
    mockBonusLeaseCreate.mockImplementationOnce(async _ => {
      throw new Error("any error");
    });

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    await handler(context, aFiscalCode);

    expect(mockBonusLeaseDeleteOneById).not.toHaveBeenCalled();

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should enqueue bonusid in case bonus creation succeed", async () => {
    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
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

    // bonus processing must be recorded in case of success
    expect(mockBonusProcessingCreate).toHaveBeenCalled();
  });

  it("should ignore failures on saving bonus processing", async () => {
    mockBonusProcessingCreate.mockImplementationOnce(async () => {
      throw new Error("any failure");
    });

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    // just a success case
    const response = await handler(context, aFiscalCode);

    expect(mockBonusProcessingCreate).toHaveBeenCalled();
    expect(response.kind).toBe("IResponseSuccessRedirectToResource");
  });

  it("should handle failure on reading bonus processing", async () => {
    mockBonusProcessingFind.mockImplementationOnce(async () => {
      throw new Error("any failure");
    });

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
      mockEligibilityCheckModel,
      enqueueBonusActivation
    );

    // just a success case
    const response = await handler(context, aFiscalCode);

    // just a success result
    expect(response.kind).toBe("IResponseErrorInternal");
  });

  it("should release family lock when message enqueing fail", async () => {
    enqueueBonusActivation.mockReturnValueOnce(
      fromLeft(ResponseErrorInternal("foo"))
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
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

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should ignore if lock release fails because no lock is found", async () => {
    enqueueBonusActivation.mockReturnValueOnce(
      fromLeft(ResponseErrorInternal("foo"))
    );
    mockBonusLeaseDeleteOneById.mockImplementationOnce(async () =>
      left({ code: 404 })
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
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

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });

  it("should ignore if lock release fails for any reason", async () => {
    enqueueBonusActivation.mockReturnValueOnce(
      fromLeft(ResponseErrorInternal("foo"))
    );
    mockBonusLeaseDeleteOneById.mockImplementationOnce(async () =>
      left({ code: 500, body: "any reason" })
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockBonusProcessingModel,
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

    // no bonus processing must be recorded
    expect(mockBonusProcessingCreate).not.toHaveBeenCalled();
  });
});

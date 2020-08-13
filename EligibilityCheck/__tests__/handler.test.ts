import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  context,
  mockGetStatus,
  mockStartNew,
  mockStatusCompleted,
  mockStatusRunning
} from "../../__mocks__/durable-functions";
import { aEligibilityCheckSuccessEligibleValid } from "../../__mocks__/mocks";
import { BonusProcessingModel } from "../../models/bonus_processing";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import { makeStartEligibilityCheckOrchestratorId } from "../../utils/orchestrators";
import { EligibilityCheckHandler } from "../handler";

// implement temporary mockGetStatus
const simulateOrchestratorIsRunning = (forOrchestratorId: string) => {
  mockGetStatus.mockImplementation(async (orchestratorId: string) =>
    orchestratorId === forOrchestratorId
      ? mockStatusRunning
      : mockStatusCompleted
  );
};
const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

const mockEligibilityCheckFind = jest
  .fn()
  .mockImplementation(() => Promise.resolve(right(none)));
const mockEligibilityCheckModel = ({
  find: mockEligibilityCheckFind
} as unknown) as EligibilityCheckModel;

const mockBonusProcessingFind = jest.fn();
const mockBonusProcessingModel = ({
  find: mockBonusProcessingFind
} as unknown) as BonusProcessingModel;

describe("EligibilityCheckHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    // This is the default, happy path behavior
    // I need this because I don't know how many times df.getStatus get called.
    mockGetStatus.mockImplementation(async () => mockStatusCompleted);
    // tslint:disable-next-line: no-object-mutation
    context.bindings = {};
  });

  it("should returns a 403 status response if a bonus activation is running", async () => {
    mockBonusProcessingFind.mockImplementation(() => taskEither.of(some(1)));

    const handler = EligibilityCheckHandler(
      mockEligibilityCheckModel,
      mockBonusProcessingModel
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });
  it("should returns a 202 status response if another EligibilityCheck is running", async () => {
    simulateOrchestratorIsRunning(
      makeStartEligibilityCheckOrchestratorId(aFiscalCode)
    );
    mockBonusProcessingFind.mockImplementation(() => taskEither.of(none));
    mockEligibilityCheckFind.mockImplementation(() => taskEither.of(none));

    const handler = EligibilityCheckHandler(
      mockEligibilityCheckModel,
      mockBonusProcessingModel
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessAccepted");
  });
  it("should returns ResponseSuccessRedirectToResource if exists a Valid EligibilityCheck", async () => {
    mockEligibilityCheckFind.mockImplementationOnce(() =>
      taskEither.of(some(aEligibilityCheckSuccessEligibleValid))
    );
    mockBonusProcessingFind.mockImplementation(() => taskEither.of(none));

    const handler = EligibilityCheckHandler(
      mockEligibilityCheckModel,
      mockBonusProcessingModel
    );

    const response = await handler(context, aFiscalCode);

    expect(mockStartNew).toBeCalledTimes(0);

    expect(response.kind).toBe("IResponseSuccessRedirectToResource");
  });
  it("should returns ResponseSuccessRedirectToResource if EligibilityCheckOrchestrator starts successfully", async () => {
    mockStartNew.mockImplementationOnce(async (_, __, ___) => {
      return "instanceId";
    });
    mockBonusProcessingFind.mockImplementation(() => taskEither.of(none));

    const handler = EligibilityCheckHandler(
      mockEligibilityCheckModel,
      mockBonusProcessingModel
    );

    const response = await handler(context, aFiscalCode);

    expect(mockStartNew).toBeCalledWith(
      "EligibilityCheckOrchestrator",
      makeStartEligibilityCheckOrchestratorId(aFiscalCode),
      aFiscalCode
    );

    expect(response.kind).toBe("IResponseSuccessRedirectToResource");
  });
  it("should returns ResponseErrorInternal if orchestrator starts fail", async () => {
    mockStartNew.mockImplementationOnce(async (_, __, ___) => {
      throw new Error("Error starting the orchestrator");
    });
    mockBonusProcessingFind.mockImplementation(() => taskEither.of(none));

    const handler = EligibilityCheckHandler(
      mockEligibilityCheckModel,
      mockBonusProcessingModel
    );

    const response = await handler(context, aFiscalCode);

    expect(mockStartNew).toBeCalledWith(
      "EligibilityCheckOrchestrator",
      makeStartEligibilityCheckOrchestratorId(aFiscalCode),
      aFiscalCode
    );

    expect(response.kind).toBe("IResponseErrorInternal");
  });
});

import { right } from "fp-ts/lib/Either";
import { none } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  context,
  mockGetStatus,
  mockStartNew,
  mockStatusCompleted,
  mockStatusRunning
} from "../../__mocks__/durable-functions";
import { aBonusId } from "../../__mocks__/mocks";
import { BonusProcessing } from "../../models/bonus_processing";
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

const mockFind = jest
  .fn()
  .mockImplementation(() => Promise.resolve(right(none)));
const mockEligibilityCheckModel = ({
  find: mockFind
} as unknown) as EligibilityCheckModel;

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
    // tslint:disable-next-line: no-object-mutation
    context.bindings.processingBonusIdIn = BonusProcessing.encode({
      bonusId: aBonusId,
      id: aFiscalCode
    });

    const handler = EligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });
  it("should returns a 202 status response if another EligibilityCheck is running", async () => {
    simulateOrchestratorIsRunning(
      makeStartEligibilityCheckOrchestratorId(aFiscalCode)
    );

    const handler = EligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessAccepted");
  });
  it("should returns ResponseSuccessRedirectToResource if EligibilityCheckOrchestrator starts successfully", async () => {
    mockStartNew.mockImplementationOnce(async (_, __, ___) => {
      return "instanceId";
    });

    const handler = EligibilityCheckHandler(mockEligibilityCheckModel);

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

    const handler = EligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(mockStartNew).toBeCalledWith(
      "EligibilityCheckOrchestrator",
      makeStartEligibilityCheckOrchestratorId(aFiscalCode),
      aFiscalCode
    );

    expect(response.kind).toBe("IResponseErrorInternal");
  });
});

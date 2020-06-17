import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  context,
  mockGetStatus,
  mockStartNew,
  mockStatusCompleted,
  mockStatusRunning
} from "../../__mocks__/durable-functions";
import {
  makeStartBonusActivationOrchestratorId,
  makeStartEligibilityCheckOrchestratorId
} from "../../utils/orchestrators";
import { EligibilityCheckHandler } from "../handler";

jest.mock("applicationinsights", () => ({
  defaultClient: {
    trackEvent: jest.fn(),
    trackException: jest.fn()
  }
}));

// implement temporary mockGetStatus
const simulateOrchestratorIsRunning = (forOrchestratorId: string) => {
  mockGetStatus.mockImplementation(async (orchestratorId: string) =>
    orchestratorId === forOrchestratorId
      ? mockStatusRunning
      : mockStatusCompleted
  );
};
const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

describe("EligibilityCheckHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    // This is the default, happy path behavior
    // I need this because I don't know how many times df.getStatus get called.
    mockGetStatus.mockImplementation(async () => mockStatusCompleted);
  });

  it("should returns a 403 status response if a bonus activation is running", async () => {
    simulateOrchestratorIsRunning(
      makeStartBonusActivationOrchestratorId(aFiscalCode)
    );

    const handler = EligibilityCheckHandler();

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe(
      "IResponseErrorForbiddenNotAuthorizedForRecipient"
    );
  });
  it("should returns a 202 status response if another EligibilityCheck is running", async () => {
    simulateOrchestratorIsRunning(
      makeStartEligibilityCheckOrchestratorId(aFiscalCode)
    );

    const handler = EligibilityCheckHandler();

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessAccepted");
  });
  it("should returns ResponseSuccessRedirectToResource if EligibilityCheckOrchestrator starts successfully", async () => {
    mockStartNew.mockImplementationOnce(async (_, __, ___) => {
      return;
    });

    const handler = EligibilityCheckHandler();

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

    const handler = EligibilityCheckHandler();

    const response = await handler(context, aFiscalCode);

    expect(mockStartNew).toBeCalledWith(
      "EligibilityCheckOrchestrator",
      makeStartEligibilityCheckOrchestratorId(aFiscalCode),
      aFiscalCode
    );

    expect(response.kind).toBe("IResponseErrorInternal");
  });
});

import { some } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  context,
  mockGetStatus,
  mockStatusCompleted,
  mockStatusRunning
} from "../../__mocks__/durable-functions";
import { aEligibilityCheckSuccessEligibleValid } from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import {
  makeStartBonusActivationOrchestratorId,
  makeStartEligibilityCheckOrchestratorId
} from "../../utils/orchestrators";
import { StartBonusActivationHandler } from "../handler";

// implement temporary mockGetStatus
const simulateOrchestratorIsRunning = (forOrchestratorId: string) => {
  mockGetStatus.mockImplementation(async (orchestratorId: string) =>
    orchestratorId === forOrchestratorId
      ? mockStatusRunning
      : mockStatusCompleted
  );
};

const mockEligibilityCheckFind = jest.fn().mockImplementation(async () =>
  // happy path: retrieve a valid eligible check
  some(aEligibilityCheckSuccessEligibleValid)
);
const mockEligibilityCheckModel = ({
  find: mockEligibilityCheckFind
} as unknown) as EligibilityCheckModel;
const mockBonusActivationModel = ({
  create: jest.fn(() => Promise.resolve({}))
} as unknown) as BonusActivationModel;

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

describe("StartBonusActivationHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should notify the user if there's already a bonus activation running", async () => {
    simulateOrchestratorIsRunning(
      makeStartBonusActivationOrchestratorId(aFiscalCode)
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessAccepted");
  });
});

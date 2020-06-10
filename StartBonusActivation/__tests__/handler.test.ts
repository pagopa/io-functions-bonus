import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  context,
  mockGetStatus,
  mockStatusCompleted,
  mockStatusRunning
} from "../../__mocks__/durable-functions";
import { BonusActivationModel } from "../../models/bonus_activation";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import {
  makeStartEligibilityCheckOrchestratorId,
  makeStartBonusActivationOrchestratorId
} from "../../utils/orchestrators";
import { StartBonusActivationHandler } from "../handler";

const mockEligibilityCheckModel = {} as EligibilityCheckModel;
const mockBonusActivationModel = {} as BonusActivationModel;

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

describe("StartBonusActivationHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should block the user if there's an eligibility check running", async () => {
    mockGetStatus.mockImplementationOnce(orchestratorId =>
      Promise.resolve(
        orchestratorId === makeStartEligibilityCheckOrchestratorId(aFiscalCode)
          ? mockStatusRunning
          : mockStatusCompleted
      )
    );

    const handler = StartBonusActivationHandler(
      mockBonusActivationModel,
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });
});

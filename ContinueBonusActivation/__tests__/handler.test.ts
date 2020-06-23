import { context, mockStartNew } from "../../__mocks__/durable-functions";
import { aBonusId, aFiscalCode } from "../../__mocks__/mocks";
import ContinueBonusActivationHandler from "../index";

const aValidBeforeDate = new Date();

describe("ContinueBonusActivation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a transient error if the orchestrator throws", async () => {
    mockStartNew.mockImplementationOnce(async () => {
      throw new Error("foobar");
    });
    try {
      await ContinueBonusActivationHandler(context, {
        applicantFiscalCode: aFiscalCode,
        bonusId: aBonusId,
        validBefore: aValidBeforeDate
      });
      fail();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("foobar");
    }
  });
});

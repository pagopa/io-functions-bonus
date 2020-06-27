import { context } from "../../__mocks__/durable-functions";
import { BonusActivationStatusEnum } from "../../generated/models/BonusActivationStatus";
import { FamilyUID } from "../../generated/models/FamilyUID";
import {
  BonusLeaseToBonusActivation,
  getCheckBonusProcessingActivityHandler
} from "../handler";

const aFamilyUID = "AAABBB80A01C123D" as FamilyUID;
const aProcessingBonusActivationStatus = BonusActivationStatusEnum.PROCESSING;

describe("CheckBonusProcessingActivityHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings = {};
  });

  it("should returns true if a bonus activation is running", async () => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.bonusLeaseBinding = BonusLeaseToBonusActivation.encode({
      Status: aProcessingBonusActivationStatus
    });

    const handler = getCheckBonusProcessingActivityHandler();

    const response = await handler(context, aFamilyUID);

    expect(response).toEqual(true);
  });
  it("should returns false if a bonus activation not exists", async () => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.bonusLeaseBinding = undefined;

    const handler = getCheckBonusProcessingActivityHandler();

    const response = await handler(context, aFamilyUID);

    expect(response).toEqual(false);
  });

  it("should returns false if a bonus activation is not running", async () => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.bonusLeaseBinding = BonusLeaseToBonusActivation.encode({
      Status: BonusActivationStatusEnum.REDEEMED
    });

    const handler = getCheckBonusProcessingActivityHandler();

    const response = await handler(context, aFamilyUID);

    expect(response).toEqual(false);
  });
});

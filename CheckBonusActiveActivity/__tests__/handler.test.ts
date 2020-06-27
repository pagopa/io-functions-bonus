import { context } from "../../__mocks__/durable-functions";
import { BonusActivationStatusEnum } from "../../generated/models/BonusActivationStatus";
import { FamilyUID } from "../../generated/models/FamilyUID";
import {
  BonusLeaseToBonusActivation,
  getCheckBonusActiveActivityHandler
} from "../handler";

const aFamilyUID = "AAABBB80A01C123D" as FamilyUID;

describe("CheckBonusActiveActivityHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings = {};
  });

  it("should return true if a bonus activation is active", async () => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.bonusLeaseBinding = BonusLeaseToBonusActivation.encode({
      Status: BonusActivationStatusEnum.ACTIVE
    });

    const handler = getCheckBonusActiveActivityHandler();

    const response = await handler(context, aFamilyUID);

    expect(response).toEqual(true);
  });
  it("should returns false if a bonus activation not exists", async () => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.bonusLeaseBinding = undefined;

    const handler = getCheckBonusActiveActivityHandler();

    const response = await handler(context, aFamilyUID);

    expect(response).toEqual(false);
  });

  it("should returns false if a bonus activation is not active", async () => {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.bonusLeaseBinding = BonusLeaseToBonusActivation.encode({
      Status: BonusActivationStatusEnum.PROCESSING
    });

    const handler = getCheckBonusActiveActivityHandler();

    const response = await handler(context, aFamilyUID);

    expect(response).toEqual(false);
  });
});

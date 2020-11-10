import { isRight } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context } from "../../__mocks__/durable-functions";
import { EligibilityCheckSuccessConflict } from "../../generated/definitions/EligibilityCheckSuccessConflict";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum
} from "../../generated/definitions/EligibilityCheckSuccessEligible";
import { FamilyMember } from "../../generated/definitions/FamilyMember";
import { BonusLeaseModel } from "../../models/bonus_lease";
import { getValidateEligibilityCheckActivityHandler } from "../handler";

const mockFind = jest.fn();
const bonusLeaseModel = ({
  find: mockFind
} as unknown) as BonusLeaseModel;

const aEligibilityCheck: EligibilityCheckSuccessEligible = {
  dsu_request: {
    dsu_created_at: new Date(),
    dsu_protocol_id: "1" as NonEmptyString,
    family_members: [
      {
        fiscal_code: "AAABBB01C02D123Z",
        name: "BBB",
        surname: "AAA"
      } as FamilyMember
    ],
    has_discrepancies: false,
    isee_type: "ISEE Semplice",
    max_amount: 150,
    max_tax_benefit: 50,
    request_id: 10
  },
  id: "1" as NonEmptyString,
  status: StatusEnum.ELIGIBLE,
  valid_before: new Date()
};

describe("ValidateEligibilityCheckActivityHandler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should return EligibilityCheckSuccessConflict if a bonus lease was found", async () => {
    mockFind.mockImplementation((id, _) => taskEither.of(some({ id })));

    const handler = getValidateEligibilityCheckActivityHandler(bonusLeaseModel);

    const result = await handler(context, aEligibilityCheck);

    expect(
      isRight(EligibilityCheckSuccessConflict.decode(result))
    ).toBeTruthy();
  });

  it("should return original input if no bonus lease was found", async () => {
    mockFind.mockImplementation((__, _) => taskEither.of(none));

    const handler = getValidateEligibilityCheckActivityHandler(bonusLeaseModel);

    const result = await handler(context, aEligibilityCheck);

    expect(result).toStrictEqual(aEligibilityCheck);
  });
});

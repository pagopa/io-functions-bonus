import { Context } from "@azure/functions";
import { fromEither, fromPredicate } from "fp-ts/lib/Option";
import * as t from "io-ts";
import { FamilyUID } from "../generated/definitions/FamilyUID";
import {
  BonusActivationStatus,
  BonusActivationStatusEnum
} from "../generated/models/BonusActivationStatus";

export const CheckBonusActiveActivityInput = t.interface({
  familyUID: FamilyUID
});
export type CheckBonusActiveActivityInput = t.TypeOf<
  typeof CheckBonusActiveActivityInput
>;

export const BonusLeaseToBonusActivation = t.interface({
  Status: BonusActivationStatus
});

export type BonusLeaseToBonusActivation = t.TypeOf<
  typeof BonusLeaseToBonusActivation
>;

// Activity result
export const ActivityResult = t.boolean;
export type ActivityResult = t.TypeOf<typeof ActivityResult>;

/**
 * Check if a BonusProcessing exists for the provided familyUID
 * returns true if a bonus activation is ACTIVE for this familyUID
 * false otherwise.
 */
export const getCheckBonusActiveActivityHandler = () => {
  return async (context: Context, _: unknown): Promise<ActivityResult> => {
    return fromEither(
      BonusLeaseToBonusActivation.decode(context.bindings.bonusLeaseBinding)
    )
      .map(bonusLeaseBinding => bonusLeaseBinding.Status)
      .chain(
        fromPredicate(status => status === BonusActivationStatusEnum.ACTIVE)
      )
      .fold(ActivityResult.encode(false), () => ActivityResult.encode(true));
  };
};

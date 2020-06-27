import { Context } from "@azure/functions";
import { fromEither, fromPredicate } from "fp-ts/lib/Option";
import * as t from "io-ts";
import { FamilyUID } from "../generated/definitions/FamilyUID";
import {
  BonusActivationStatus,
  BonusActivationStatusEnum
} from "../generated/models/BonusActivationStatus";

export const CheckBonusProcessingActivityInput = t.interface({
  familyUID: FamilyUID
});
export type CheckBonusProcessingActivityInput = t.TypeOf<
  typeof CheckBonusProcessingActivityInput
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
 * returns true if a bonus activation is running for this familyUID
 * false otherwise.
 */
export const getCheckBonusProcessingActivityHandler = () => {
  return async (context: Context, _: unknown): Promise<ActivityResult> => {
    return fromEither(
      BonusLeaseToBonusActivation.decode(context.bindings.bonusLeaseBinding)
    )
      .map(bonusLeaseBinding => bonusLeaseBinding.Status)
      .chain(
        fromPredicate(status => status === BonusActivationStatusEnum.PROCESSING)
      )
      .fold(ActivityResult.encode(false), () => ActivityResult.encode(true));
  };
};

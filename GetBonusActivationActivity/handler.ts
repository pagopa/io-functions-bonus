import { Context } from "@azure/functions";
import {
  fromEither,
  fromLeft,
  fromPredicate,
  taskEither
} from "fp-ts/lib/TaskEither";
import { fromQueryEither } from "io-functions-commons/dist/src/utils/documentdb";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusCode } from "../generated/models/BonusCode";
import {
  BonusActivationModel,
  RetrievedBonusActivation
} from "../models/bonus_activation";
import { trackException } from "../utils/appinsights";
import { Failure } from "../utils/errors";

export const GetBonusActivationActivityInput = t.type({
  applicantFiscalCode: FiscalCode,
  bonusId: BonusCode
});
export type GetBonusActivationActivityInput = t.TypeOf<
  typeof GetBonusActivationActivityInput
>;

export const GetBonusActivationActivityOutput = t.taggedUnion("kind", [
  Failure,
  t.type({
    bonusActivation: RetrievedBonusActivation,
    kind: t.literal("SUCCESS")
  })
]);
export type GetBonusActivationActivityOutput = t.TypeOf<
  typeof GetBonusActivationActivityOutput
>;

type IGetBonusActivationHandler = (
  context: Context,
  input: unknown
) => Promise<GetBonusActivationActivityOutput>;

export function getGetBonusActivationActivityHandler(
  bonusActivationModel: BonusActivationModel,
  logPrefix = "GetBonusActivationActivity"
): IGetBonusActivationHandler {
  return (_, input) => {
    return taskEither
      .of<Failure, void>(void 0)
      .chainSecond(
        fromEither(
          GetBonusActivationActivityInput.decode(input).mapLeft(errs =>
            Failure.encode({
              kind: "PERMANENT",
              reason: `Cannot decode input: ${readableReport(errs)}`
            })
          )
        )
      )
      .chain(({ applicantFiscalCode, bonusId }) =>
        fromQueryEither(() =>
          bonusActivationModel.findBonusActivationForUser(
            bonusId,
            applicantFiscalCode
          )
        ).mapLeft(err =>
          // Promise rejected or thrown
          Failure.encode({
            kind: "PERMANENT",
            reason: `Query error: ${err.code}=${err.body}`
          })
        )
      )
      .chain<RetrievedBonusActivation>(maybeBonusActivation =>
        maybeBonusActivation.fold(
          fromLeft(
            Failure.encode({
              kind: "PERMANENT",
              reason: "Bonus activation not found"
            })
          ),
          bonusActivation => taskEither.of(bonusActivation)
        )
      )
      .chain(
        fromPredicate(
          bonusActivation => bonusActivation.status === "PROCESSING",
          _ =>
            Failure.encode({
              kind: "PERMANENT",
              reason: "Bonus activation status is not PROCESSING"
            })
        )
      )
      .fold<Failure | GetBonusActivationActivityOutput>(
        err => {
          const error = `${logPrefix}|${err.kind}_ERROR=${err.reason}`;
          trackException({
            exception: new Error(error),
            properties: {
              name: "bonus.activation.processing"
            }
          });
          return err;
        },
        bonusActivation => ({
          bonusActivation,
          kind: "SUCCESS"
        })
      )
      .run();
  };
}

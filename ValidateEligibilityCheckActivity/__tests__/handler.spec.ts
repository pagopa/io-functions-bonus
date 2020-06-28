// tslint:disable: no-any no-console no-dead-store

import * as fc from "fast-check";

import { Either, left, right } from "fp-ts/lib/Either";
import * as t from "io-ts";

import { PromiseType } from "italia-ts-commons/lib/types";

import { EligibilityCheck } from "../../generated/definitions/EligibilityCheck";
import { StatusEnum as EligibleStatusEnum } from "../../generated/definitions/EligibilityCheckSuccessEligible";

import { BonusLeaseModel, RetrievedBonusLease } from "../../models/bonus_lease";

import {
  eitherArb,
  getArbitrary,
  optionArb
} from "../../__tests__/fc-io.helper";

import { getValidateEligibilityCheckActivityHandler } from "../handler";

const QueryError = t.interface({
  body: t.string,
  code: t.union([
    t.literal(401),
    t.literal(404),
    t.literal(409),
    t.literal(500)
  ])
});

describe("RetrievedBonusLease", () => {
  xit("should always decode", () => {
    const retrievedBonusLeaseArb = getArbitrary(RetrievedBonusLease as any);
    fc.assert(
      fc.property(retrievedBonusLeaseArb, o => {
        expect(RetrievedBonusLease.decode(o).isRight()).toBeTruthy();
      })
    );
  });
});

describe("handler", () => {
  const context = {
    log: {
      debug: console.log,
      error: console.error,
      info: console.log
    }
  } as any;

  const eligibilityCheckArb = getArbitrary(EligibilityCheck);
  const retrievedBonusLeaseArb = getArbitrary(RetrievedBonusLease as any);
  const queryErrorArb = getArbitrary(QueryError);
  const findResultArb = eitherArb(
    queryErrorArb,
    optionArb(retrievedBonusLeaseArb)
  );

  it("should reject if unable to decode input", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async ec => {
        const bonusLeaseModel = {
          find: () => Promise.resolve({})
        };

        const handler = getValidateEligibilityCheckActivityHandler(
          (bonusLeaseModel as unknown) as BonusLeaseModel
        );

        await expect(handler(context, ec)).rejects.toBeDefined();
      })
    );
  });

  it("should resolve to input if status is not ELIGIBLE", async () => {
    const notEligibleEligibilityCheckArb = eligibilityCheckArb.filter(
      _ => _.status !== EligibleStatusEnum.ELIGIBLE
    );
    await fc.assert(
      fc.asyncProperty(notEligibleEligibilityCheckArb, async ec => {
        const bonusLeaseModel = {
          find: () => Promise.resolve({})
        };

        const handler = getValidateEligibilityCheckActivityHandler(
          (bonusLeaseModel as unknown) as BonusLeaseModel
        );

        await expect(handler(context, ec)).resolves.toEqual(ec);
      })
    );
  });

  it("should always complete", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.scheduler(),
        eligibilityCheckArb,
        findResultArb,
        async (s, ec, findResult) => {
          const bonusLeaseModel = {
            find: () => s.schedule(Promise.resolve(findResult), "find")
          };

          const handler = getValidateEligibilityCheckActivityHandler(
            (bonusLeaseModel as unknown) as BonusLeaseModel
          );

          // tslint:disable-next-line: no-let
          let result: Either<
            unknown,
            PromiseType<ReturnType<typeof handler>>
          > | null = null;
          const __ = s.schedule(Promise.resolve("HANDLER")).then(() =>
            handler(context, ec).then(
              _ => {
                result = right(_);
              },
              _ => {
                result = left(_);
              }
            )
          );
          await s.waitAll();

          expect(result).toBeDefined();
        }
      )
    );
  });
});

// tslint:disable: no-any
import { left, right } from "fp-ts/lib/Either";

import * as fc from "fast-check";
import { Arbitrary } from "fast-check";

import {
  fiscalCodeArb,
  getArbitrary,
  nonEmptyStringArb
} from "../../__tests__/fc-io.helper";

import { RetrievedEligibilityCheck } from "../../models/eligibility_check";

import { EligibilityCheckSuccessEligible } from "../../generated/models/EligibilityCheckSuccessEligible";

import { createBonusActivation, eligibilityCheckToResponse } from "../models";

import { Dsu } from "../../generated/models/Dsu";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { RetrievedBonusActivation } from "../../models/bonus_activation";

describe("eligibilityCheckToResponse", () => {
  const retrievedEligibilityCheckArb = (getArbitrary(
    RetrievedEligibilityCheck as any
  ) as unknown) as Arbitrary<RetrievedEligibilityCheck>;

  it("should respond with 401 if not eligible", async () => {
    await fc.assert(
      fc.asyncProperty(retrievedEligibilityCheckArb, async ec => {
        fc.pre(!EligibilityCheckSuccessEligible.is(ec));
        const response = await eligibilityCheckToResponse(ec).run();
        expect(response.isLeft()).toBeTruthy();
        response.mapLeft(l =>
          expect(l.kind).toBe("IResponseErrorForbiddenNotAuthorized")
        );
      })
    );
  });

  it("should respond with 410 if expired", async () => {
    await fc.assert(
      fc.asyncProperty(retrievedEligibilityCheckArb, async ec => {
        fc.pre(EligibilityCheckSuccessEligible.is(ec));
        if (EligibilityCheckSuccessEligible.is(ec)) {
          const response = await eligibilityCheckToResponse(
            ec,
            // tslint:disable-next-line restrict-plus-operands
            () => new Date(ec.validBefore.valueOf() + 1)
          ).run();
          expect(response.isLeft()).toBeTruthy();
          response.mapLeft(l => expect(l.kind).toBe("IResponseErrorGone"));
        }
      })
    );
  });

  it("should respond with successful eligibility check if not expired", async () => {
    await fc.assert(
      fc.asyncProperty(retrievedEligibilityCheckArb, async ec => {
        fc.pre(EligibilityCheckSuccessEligible.is(ec));
        if (EligibilityCheckSuccessEligible.is(ec)) {
          const response = await eligibilityCheckToResponse(
            ec,
            () => new Date(ec.validBefore.valueOf() - 1)
          ).run();
          expect(response.isRight()).toBeTruthy();
          response.map(r => expect(r).toEqual(ec));
        }
      })
    );
  });
});

describe("createBonusActivation", () => {
  const dsuArb = getArbitrary(Dsu);
  const retrievedBonusActivationArb = getArbitrary(
    RetrievedBonusActivation as any
  );

  it("should create a bonus activation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fiscalCodeArb,
        nonEmptyStringArb,
        dsuArb,
        retrievedBonusActivationArb,
        async (fiscalCode, familyUID, dsu, retrievedBonusActivation) => {
          const model = {
            create: () => Promise.resolve(right(retrievedBonusActivation))
          };
          const result = await createBonusActivation(
            model as any,
            fiscalCode,
            familyUID as NonEmptyString,
            dsu
          ).run();
          expect(result).toEqual(right(retrievedBonusActivation));
        }
      )
    );
  });

  it("should fail on max retries", async () => {
    await fc.assert(
      fc.asyncProperty(
        fiscalCodeArb.noShrink(),
        nonEmptyStringArb.noShrink(),
        dsuArb.noShrink(),
        async (fiscalCode, familyUID, dsu) => {
          const model = {
            create: () =>
              Promise.resolve(
                left({
                  body: "409",
                  code: 409
                })
              )
          };

          const result = await createBonusActivation(
            model as any,
            fiscalCode,
            familyUID as NonEmptyString,
            dsu
          ).run();

          expect(result.isLeft()).toBeTruthy();
          if (result.isLeft()) {
            expect(result.value.kind).toEqual("IResponseErrorInternal");
          }
        }
      ),
      { numRuns: 1 }
    );
  });
});

/**
 * Do not edit this file it is auto-generated by italia-utils / gen-api-models.
 * See https://github.com/teamdigitale/italia-utils
 */
/* tslint:disable */

import * as t from "io-ts";
import { NonEmptyString, FiscalCode } from "italia-ts-commons/lib/strings";

// required attributes
const FamilyMemberR = t.interface({
  name: NonEmptyString,

  surname: NonEmptyString
});

// optional attributes
const FamilyMemberO = t.partial({
  fiscalCode: FiscalCode
});

export const FamilyMember = t.exact(
  t.intersection([FamilyMemberR, FamilyMemberO], "FamilyMember")
);

export type FamilyMember = t.TypeOf<typeof FamilyMember>;

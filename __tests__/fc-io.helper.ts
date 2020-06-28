// tslint:disable: interface-name readonly-array array-type no-any

//
// DISCLAIMER
// Most of the following code is taken from https://github.com/giogonzo/fast-check-io-ts
// and has been adapted to work with io-ts 1.x and with our custom types
//

import * as fc from "fast-check";

import * as t from "io-ts";

import { Either, left, right } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";
import * as record from "fp-ts/lib/Record";

import { FiscalCode } from "italia-ts-commons/lib/strings";
import { readableReport } from "italia-ts-commons/lib/reporters";

interface ArrayType extends t.ArrayType<HasArbitrary> {}
interface ReadonlyArrayType extends t.ReadonlyArrayType<HasArbitrary> {}
interface RecordType extends t.DictionaryType<t.StringType, HasArbitrary> {}
interface StructType
  extends t.InterfaceType<Record<string, t.TypeOf<HasArbitrary>>> {}
interface ExactType extends t.ExactType<HasArbitrary> {}
interface TupleType extends t.TupleType<Array<HasArbitrary>> {}
interface PartialType extends t.PartialType<Record<string, HasArbitrary>> {}
interface UnionType extends t.UnionType<Array<HasArbitrary>> {}
interface IntersectionType extends t.IntersectionType<Array<HasArbitrary>> {}
interface BrandedType extends t.RefinementType<HasArbitrary> {}

export type HasArbitrary =
  | t.UnknownType
  | t.UndefinedType
  | t.NullType
  | t.VoidType
  | t.StringType
  | t.NumberType
  | t.BooleanType
  | t.KeyofType<any>
  | t.LiteralType<any>
  | ArrayType
  | ReadonlyArrayType
  | RecordType
  | StructType
  | ExactType
  | PartialType
  | TupleType
  | UnionType
  | IntersectionType
  | BrandedType;

const isDebug = process.env.FC_IO_DEBUG === "1";
const log = (s: string) => (isDebug ? process.stderr.write(s + "\n") : 0);

const UPPER_CASE_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const upAlphaArb = fc
  .nat(UPPER_CASE_ALPHA.length - 1)
  .map(i => UPPER_CASE_ALPHA[i]);
const numArb = fc.nat(9).map(String);
const upAlphaNumArb = fc.oneof(upAlphaArb, numArb);

export const nonEmptyStringArb = fc
  .stringOf(upAlphaNumArb)
  .filter(_ => _.length > 0);

// ^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$
export const fiscalCodeArb = fc
  .tuple(
    fc.stringOf(upAlphaArb, 6, 6), // [A-Z]{6}
    fc.stringOf(upAlphaNumArb, 2, 2), // [0-9LMNPQRSTUV]{2}
    upAlphaArb, // [ABCDEHLMPRST]
    fc.stringOf(upAlphaNumArb, 2, 2), // [0-9LMNPQRSTUV]{2}
    upAlphaArb, // [A-Z]
    fc.stringOf(upAlphaNumArb, 3, 3), // [0-9LMNPQRSTUV]{3}
    upAlphaArb // [A-Z]
  )
  .map(t => t.join(""))
  .filter(FiscalCode.is)
  .noShrink();

const BONUS_CODE_ALPHABET = "ACEFGHLMNPRUV3469";
const bonusCodeArb = fc
  .stringOf(
    fc.nat(BONUS_CODE_ALPHABET.length - 1).map(_ => BONUS_CODE_ALPHABET[_]),
    12,
    12
  )
  .noShrink();

function getProps(
  codec: t.InterfaceType<any> | t.ExactType<any> | t.PartialType<any>
): t.Props {
  log(`    > getProps: ${codec._tag}`);
  switch (codec._tag) {
    case "InterfaceType":
    case "PartialType":
      log(`    >> PARTIAL PROPS: ${JSON.stringify(Object.keys(codec.props))}`);
      return codec.props;
    case "ExactType":
      return getProps(codec.type);
  }
}

const objectTypes = [
  "ExactType",
  "InterfaceType",
  "PartialType",
  "IntersectionType"
];

const isObjectTypeTag = (tag: string): boolean => objectTypes.includes(tag);

function isObjectIntersection(type: IntersectionType | UnionType): boolean {
  const firstSubType = type.types[0];
  const firstSubTypeTag = firstSubType._tag;
  if (isObjectTypeTag(firstSubTypeTag)) {
    // if first type is an object type we can assume that this is an object intersection
    return true;
  }

  if (firstSubTypeTag === "UnionType") {
    return isObjectIntersection((firstSubType as any) as UnionType);
  }

  return false;
}

export function getArbitrary<T extends HasArbitrary>(
  codec: T
): fc.Arbitrary<t.TypeOf<T>> {
  const type: HasArbitrary = codec as any;
  log(`------ [${codec.name}] [${type._tag}] ----`);
  switch (type._tag) {
    case "UnknownType":
      return fc.anything() as any;
    case "UndefinedType":
    case "VoidType":
      return fc.constant(undefined) as any;
    case "NullType":
      return fc.constant(null) as any;
    case "StringType":
      return fc.string() as any;
    case "NumberType":
      return fc.float() as any;
    case "BooleanType":
      return fc.boolean() as any;
    case "KeyofType":
      log(`    keys: ${JSON.stringify(Object.keys(type.keys))}`);
      const ks = Object.keys(type.keys).map(fc.constant);
      return fc.oneof(...ks) as any;
    case "LiteralType":
      return fc.constant(type.value);
    case "ArrayType":
    case "ReadonlyArrayType":
      return fc.array(getArbitrary(type.type)) as any;
    case "DictionaryType":
      return fc.dictionary(
        getArbitrary(type.domain),
        getArbitrary(type.codomain)
      ) as any;
    case "InterfaceType":
    case "PartialType":
      const props = getProps(type);
      log(`    PROPS: ${Object.keys(props).join(",")}`);
      const r = record.map(props, _ => getArbitrary(_ as any));
      // log(`    MAPPED: ${JSON.stringify(r)}`);
      return fc.record(r as any) as any;
    case "ExactType":
      return getArbitrary(type.type) as any;
    case "TupleType":
      return (fc.tuple as any)(...type.types.map(getArbitrary));
    case "UnionType":
      log(`    subtypes: ${type.types.map(_ => _.name)}`);
      return fc.oneof(...type.types.map(getArbitrary)) as any;
    case "IntersectionType":
      if (isObjectIntersection(type)) {
        log(
          `    Intersection of objects: ${JSON.stringify(type.types[0]._tag)}`
        );
        return (fc.tuple as any)(...type.types.map(t1 => getArbitrary(t1)))
          .map((values: Array<object>) => {
            const o = values.reduce((acc: any, v: any) => {
              Object.keys(v).forEach(k => {
                if (acc[k] === undefined) {
                  acc[k] = v[k] as any;
                }
              });
              return acc;
            }, {});
            log(`ARB[${type.name}]/${type.is(o)}: ${JSON.stringify(o)}`);
            const decoded = type.decode(o);
            if (decoded.isLeft()) {
              log(`!! not valid: ${readableReport(decoded.value)}`);
            }
            return o;
          })
          .filter(type.is);
      }
      log(`    Intersection of scalar: ${JSON.stringify(type.types)}`);
      return fc
        .oneof(...type.types.map(t2 => getArbitrary(t2)))
        .filter(type.is);
    case "RefinementType":
      if (
        codec.name.indexOf(
          "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"
        ) !== -1
      ) {
        // fiscal code
        log("    Handling as FiscalCode");
        return fiscalCodeArb as any;
      }
      if (codec.name.indexOf("^[ACEFGHLMNPRUV3469]{12}$") !== -1) {
        // bonus code
        log("    Handling as BonusCode");
        return bonusCodeArb as any;
      }
      if (codec.name.indexOf("non empty string") !== -1) {
        log("    Handling as NonEmptyString");
        return nonEmptyStringArb as any;
      }
      if (codec.name === "Integer") {
        log("    Handling as Integer >= 0");
        return fc.nat() as any;
      }
      log("    !WARNING: handling as filtered arb, this may cause problems");
      return getArbitrary(type.type).filter(_ => {
        log(`ARB[${type.name}]/${type.predicate(_)}: ${_}`);
        return type.predicate(_);
      }) as any;

    case undefined:
      switch (codec.name) {
        case "UTCISODateFromString":
        case "DateFromString":
          log("    > handling as Date");
          return fc.date() as any;
      }
      log(`    !!! NOT HANDLED: ${codec.name}`);
      return fc.anything() as any;
    default:
      log(`    !!! NOT HANDLED: [${type}]`);
      return fc.anything() as any;
  }
}

export const optionArb = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<Option<T>> =>
  fc.tuple(fc.boolean(), arb).map(([isSome, o]) => (isSome ? some(o) : none));

export const eitherArb = <L, R>(
  lArb: fc.Arbitrary<L>,
  rArb: fc.Arbitrary<R>
): fc.Arbitrary<Either<L, R>> =>
  fc
    .tuple(fc.boolean(), lArb, rArb)
    .map(([isRight, l, r]) => (isRight ? right(r) : left(l)));

export const promiseArb = <L, R>(
  rejectArb: fc.Arbitrary<L>,
  resolveArb: fc.Arbitrary<R>
): fc.Arbitrary<Promise<R>> =>
  fc
    .tuple(fc.boolean(), rejectArb, resolveArb)
    .map(([isResolve, l, r]) =>
      isResolve ? Promise.resolve(r) : Promise.reject(l)
    );

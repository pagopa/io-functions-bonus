/**
 * Http client to interact with ADE API
 */

import * as t from "io-ts";

import {
  ApiHeaderJson,
  createFetchRequestForApi,
  TypeofApiCall
} from "italia-ts-commons/lib/requests";

import { BonusVacanzaError } from "../generated/ade/BonusVacanzaError";
import {
  richiestaBonusDefaultDecoder,
  RichiestaBonusT
} from "../generated/ade/requestTypes";

export type ADEClient = typeof ADEClient;
export type ADEClientInstance = ReturnType<typeof ADEClient>;
/**
 * Creates a client which implements the http operations exposed by ADE API service
 * @param baseUrl
 * @param fetchApi
 */
export function ADEClient(
  baseUrl: string,
  fetchApi: typeof fetch
): {
  readonly richiestaBonus: TypeofApiCall<typeof richiestaBonusT>;
} {
  const options = {
    baseUrl,
    fetchApi
  };

  const richiestaBonusT: RichiestaBonusT = {
    body: params => JSON.stringify(params.bonusVacanzaBase),
    headers: ApiHeaderJson,
    method: "post",
    query: _ => ({}),
    response_decoder: richiestaBonusDefaultDecoder(),
    url: () => `/BonusVacanzeWeb/rest/richiestaBonus`
  };

  return {
    richiestaBonus: createFetchRequestForApi(richiestaBonusT, options)
  };
}

/**
 * Custom Error codes mapping
 */

export type BonusVacanzaGenericError = t.TypeOf<
  typeof BonusVacanzaGenericError
>;
export const BonusVacanzaGenericError = t.intersection(
  [
    BonusVacanzaError,
    t.interface({
      errorCode: t.literal("4000")
    })
  ],
  "BonusVacanzaGenericError"
);

export type BonusVacanzaApplicationGenericError = t.TypeOf<
  typeof BonusVacanzaApplicationGenericError
>;
export const BonusVacanzaApplicationGenericError = t.intersection(
  [
    BonusVacanzaError,
    t.interface({
      errorCode: t.literal("3000")
    })
  ],
  "BonusVacanzaApplicationGenericError"
);

export type BonusVacanzaCodeAlreadyPresentError = t.TypeOf<
  typeof BonusVacanzaCodeAlreadyPresentError
>;
export const BonusVacanzaCodeAlreadyPresentError = t.intersection(
  [
    BonusVacanzaError,
    t.interface({
      errorCode: t.literal("1000")
    })
  ],
  "BonusVacanzaCodeAlreadyPresentError"
);

export type BonusVacanzaRequestedByRequestedByOtherFamilyMemberError = t.TypeOf<
  typeof BonusVacanzaRequestedByRequestedByOtherFamilyMemberError
>;
export const BonusVacanzaRequestedByRequestedByOtherFamilyMemberError = t.intersection(
  [
    BonusVacanzaError,
    t.interface({
      errorCode: t.literal("1005")
    })
  ],
  "BonusVacanzaOtherFamilyMemberError"
);

export type BonusVacanzaEmptyFamilyError = t.TypeOf<
  typeof BonusVacanzaEmptyFamilyError
>;
export const BonusVacanzaEmptyFamilyError = t.intersection(
  [
    BonusVacanzaError,
    t.interface({
      errorCode: t.literal("900")
    })
  ],
  "BonusVacanzaEmptyFamilyError"
);

export type BonusVacanzaNoFiscalCodeProvidedProvidedError = t.TypeOf<
  typeof BonusVacanzaNoFiscalCodeProvidedProvidedError
>;
export const BonusVacanzaNoFiscalCodeProvidedProvidedError = t.intersection(
  [
    BonusVacanzaError,
    t.interface({
      errorCode: t.literal("907")
    })
  ],
  "BonusVacanzaNoFiscalCodeProvidedProvidedError"
);

export type BonusVacanzaNoGenerationDateProvidedProvidedError = t.TypeOf<
  typeof BonusVacanzaNoGenerationDateProvidedProvidedError
>;
export const BonusVacanzaNoGenerationDateProvidedProvidedError = t.intersection(
  [
    BonusVacanzaError,
    t.interface({
      errorCode: t.literal("908")
    })
  ],
  "BonusVacanzaNoGenerationDateProvidedProvidedError"
);

/**
 * Group errors by meaning
 */

// A generic error which is meant to be transient and thus may allow a retry
export type BonusVacanzaTransientError = t.TypeOf<
  typeof BonusVacanzaTransientError
>;
export const BonusVacanzaTransientError = t.union(
  [BonusVacanzaGenericError, BonusVacanzaApplicationGenericError],
  "BonusVacanzaTransientError"
);

// A validation error regarding provided request data
export type BonusVacanzaInvalidRequestError = t.TypeOf<
  typeof BonusVacanzaInvalidRequestError
>;
export const BonusVacanzaInvalidRequestError = t.union(
  [
    BonusVacanzaCodeAlreadyPresentError,
    BonusVacanzaRequestedByRequestedByOtherFamilyMemberError,
    BonusVacanzaEmptyFamilyError,
    BonusVacanzaNoFiscalCodeProvidedProvidedError,
    BonusVacanzaNoGenerationDateProvidedProvidedError
  ],
  "BonusVacanzaInvalidRequestError"
);

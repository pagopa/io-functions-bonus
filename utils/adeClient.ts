import {
  ApiHeaderJson,
  createFetchRequestForApi,
  TypeofApiCall
} from "italia-ts-commons/lib/requests";

import {
  richiestaBonusDefaultDecoder,
  RichiestaBonusT
} from "../generated/ade/requestTypes";

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

export type ADEClient = typeof ADEClient;

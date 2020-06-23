import { agent } from "italia-ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { Millisecond } from "italia-ts-commons/lib/units";
import { UrlFromString } from "italia-ts-commons/lib/url";

export const getProtocol = (endpoint: string) =>
  UrlFromString.decode(endpoint)
    .map(url => url.protocol?.slice(0, -1))
    .getOrElse(undefined);

export const withTimeout = (timeout: Millisecond) => (fetchApi: typeof fetch) =>
  toFetch(setFetchTimeout(timeout, AbortableFetch(fetchApi)));

export const withCertificate = (
  protocol: string,
  getCerts: () => { cert: string; key: string }
) => () =>
  protocol === "http"
    ? agent.getHttpFetch(process.env)
    : agent.getHttpsFetch(process.env, getCerts());

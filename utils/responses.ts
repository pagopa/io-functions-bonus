import * as express from "express";
import { IResponse } from "italia-ts-commons/lib/responses";
/**
 * Interface for a no content response returning a empty object.
 */
export interface IResponseErrorGone extends IResponse<"IResponseErrorGone"> {
  readonly value: {};
}
/**
 * Returns a no content json response.
 */
export function ResponseErrorGone(detail: string): IResponseErrorGone {
  return {
    apply: (res: express.Response) => res.status(410).json({ detail }),
    kind: "IResponseErrorGone",
    value: { detail }
  };
}

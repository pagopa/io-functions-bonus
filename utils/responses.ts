import * as express from "express";
import { IResponse } from "italia-ts-commons/lib/responses";
/**
 * Interface for a gone response returning status 410.
 */
export interface IResponseErrorGone extends IResponse<"IResponseErrorGone"> {
  readonly value: { detail: string };
}
/**
 * Returns a json response with status 410.
 */
export function ResponseErrorGone(detail: string): IResponseErrorGone {
  return {
    apply: (res: express.Response) => res.status(410).json({ detail }),
    kind: "IResponseErrorGone",
    value: { detail }
  };
}

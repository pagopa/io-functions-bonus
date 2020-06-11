/**
 * Collection of response types missing in italia-ts-commons/lib/responses
 */

import {
  HttpStatusCodeEnum,
  IResponse,
  ResponseErrorGeneric
} from "italia-ts-commons/lib/responses";

// A custom response type for 401 Gone
// TODO: Move it to "italia-ts-commons/lib/responses"
export interface IResponseErrorResourceGone
  extends IResponse<"IResponseErrorResourceGone"> {}
export const ResponseErrorResourceGone: IResponseErrorResourceGone = {
  ...ResponseErrorGeneric(
    HttpStatusCodeEnum.HTTP_STATUS_410,
    "Gone",
    "The resource you are looking for does not longer exist"
  ),
  kind: "IResponseErrorResourceGone"
};

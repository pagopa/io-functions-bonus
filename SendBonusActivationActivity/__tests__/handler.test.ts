import { Context } from "@azure/functions";
import { Either, isRight, Left, left, right, toError } from "fp-ts/lib/Either";
import { fromEither, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { context } from "../../__mocks__/durable-functions";
import { BonusVacanzaBase } from "../../generated/ade/BonusVacanzaBase";
import {
  ADEClientInstance,
  BonusVacanzaInvalidRequestError,
  BonusVacanzaTransientError
} from "../../utils/adeClient";
import {
  SendBonusActivationFailure,
  SendBonusActivationHandler,
  SendBonusActivationSuccess
} from "../handler";

const mockContext: Context = context;

const aBonusVacanzaBase: BonusVacanzaBase = {};
const aBonusVacanzaInvalidRequestError: BonusVacanzaInvalidRequestError = {
  errorCode: "1000",
  errorMessage: "lorem ipsum"
};
const aBonusVacanzaTransientError: BonusVacanzaTransientError = {
  errorCode: "3000",
  errorMessage: "Generic Error"
};

describe("SendBonusActivationHandler", () => {
  it("should handle a success response", async () => {
    const mockADEClient = {
      richiestaBonus: jest.fn(() =>
        Promise.resolve(
          right({
            headers: {},
            status: 200,
            value: { result: aBonusVacanzaBase }
          })
        )
      )
    } as ADEClientInstance;

    const handler = SendBonusActivationHandler(mockADEClient);

    const result = await handler(context, aBonusVacanzaBase);

    expect(isRight(SendBonusActivationSuccess.decode(result))).toBeTruthy();
  });

  it("should handle an invalid request response", async () => {
    const mockADEClient = {
      richiestaBonus: jest.fn(() =>
        Promise.resolve(
          right({
            headers: {},
            status: 400,
            value: aBonusVacanzaInvalidRequestError
          })
        )
      )
    } as ADEClientInstance;

    const handler = SendBonusActivationHandler(mockADEClient);

    const result = await handler(context, aBonusVacanzaBase);

    SendBonusActivationFailure.decode(result)
      .orElse(_ => fail("Cannot decode result"))
      .map(value => {
        expect(value.reason).toEqual(aBonusVacanzaInvalidRequestError);
      });
  });

  it("should handle an unhandle error response payload", async () => {
    const mockADEClient = ({
      richiestaBonus: jest.fn(() =>
        Promise.resolve(
          right({
            headers: {},
            status: 123,
            value: { foo: "bar" }
          })
        )
      )
    } as unknown) as ADEClientInstance;

    const handler = SendBonusActivationHandler(mockADEClient);

    const result = await handler(context, aBonusVacanzaBase);
    SendBonusActivationFailure.decode(result)
      .orElse(_ => fail("Cannot decode result"))
      .map(value => {
        expect(value.reason).toEqual(
          JSON.stringify({
            headers: {},
            status: 123,
            value: { foo: "bar" }
          })
        );
      });
  });

  it("should handle a deconding error", async () => {
    const aFailingDecode = t.string.decode(10);
    const mockADEClient = ({
      richiestaBonus: jest.fn(() => Promise.resolve(aFailingDecode))
    } as unknown) as ADEClientInstance;

    const handler = SendBonusActivationHandler(mockADEClient);

    const result = await handler(context, aBonusVacanzaBase);
    SendBonusActivationFailure.decode(result)
      .orElse(_ => fail("Cannot decode result"))
      .map(value => {
        expect(value.reason).toEqual(expect.any(String));
      });
  });

  it("should handle an unhandled rejection", async () => {
    const mockADEClient = ({
      richiestaBonus: jest.fn(() => Promise.reject("error message"))
    } as unknown) as ADEClientInstance;

    const handler = SendBonusActivationHandler(mockADEClient);

    const result = await handler(context, aBonusVacanzaBase);
    SendBonusActivationFailure.decode(result)
      .orElse(_ => fail("Cannot decode result"))
      .map(value => {
        expect(value.reason).toEqual("error message");
      });
  });

  it("should throw on transient error", async () => {
    const mockADEClient = ({
      richiestaBonus: jest.fn(() =>
        Promise.resolve(
          right({
            headers: {},
            status: 500,
            value: aBonusVacanzaTransientError
          })
        )
      )
    } as unknown) as ADEClientInstance;

    const handler = SendBonusActivationHandler(mockADEClient);

    try {
      const _ = await handler(context, aBonusVacanzaBase);
      fail("Should have been thrown");
    } catch (err) {
      expect(err).toEqual({
        headers: {},
        status: 500,
        value: aBonusVacanzaTransientError
      });
    }
  });
});

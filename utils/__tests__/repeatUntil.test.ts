import { toError } from "fp-ts/lib/Either";
import { tryCatch } from "fp-ts/lib/TaskEither";
import { MAX_REPEAT_TIMES, neverRepeat, repeatUntil } from "../repeatUntil";

const RESOLVE_VALUE = Symbol();
const REJECT_VALUE = Symbol();

const createFnThatFailsNTimes = (
  n: number,
  r = RESOLVE_VALUE,
  l = REJECT_VALUE
) => {
  const fn = jest.fn();
  // tslint:disable-next-line: no-parameter-reassignment
  while (--n) {
    fn.mockImplementationOnce(() => Promise.reject(l));
  }
  fn.mockImplementationOnce(() => Promise.resolve(r));
  return fn;
};

describe("repeatUntil", () => {
  it("should return a successful task when the function succeed", () => {
    const fnThatNeverFails = jest.fn(() => Promise.resolve(RESOLVE_VALUE));
    const taskThatNeverFails = tryCatch(fnThatNeverFails, toError);
    repeatUntil(() => taskThatNeverFails).fold(
      _ => fail("should never fail here"),
      r => {
        expect(r).toBe(RESOLVE_VALUE);
        expect(fnThatNeverFails).toBeCalledTimes(1);
      }
    );
  });

  it("should return failed task when the function fails and never repeat", () => {
    const fnThatAlwaysFails = jest.fn(() => Promise.reject(REJECT_VALUE));
    const taskThatAlwaysFails = tryCatch(fnThatAlwaysFails, toError);
    repeatUntil(() => taskThatAlwaysFails, neverRepeat).fold(
      l => {
        expect(l).toBe(REJECT_VALUE);
        expect(fnThatAlwaysFails).toBeCalledTimes(1);
      },
      _ => {
        fail("should never succeed here");
      }
    );
  });

  it("should repeat for a maximum of times", () => {
    const fnThatFailsMoreTimesThanMaximum = createFnThatFailsNTimes(
      MAX_REPEAT_TIMES * 2
    );
    const taskThatFailsMoreTimesThanMaximum = tryCatch(
      fnThatFailsMoreTimesThanMaximum,
      toError
    );
    repeatUntil(() => taskThatFailsMoreTimesThanMaximum).fold(
      l => {
        expect(l).toBe(REJECT_VALUE);
        expect(fnThatFailsMoreTimesThanMaximum).toBeCalledTimes(
          MAX_REPEAT_TIMES
        );
      },
      _ => {
        fail("should never succeed here");
      }
    );
  });

  it("should accept a custom shouldRepeat function", () => {
    // tslint:disable-next-line: no-let
    let attempts = MAX_REPEAT_TIMES - 1; // ensure don't reach maximum
    const blockAfterAttempts = () => --attempts > 0;
    const fnThatAlwaysFails = jest.fn(() => Promise.reject(REJECT_VALUE));
    const taskThatAlwaysFails = tryCatch(fnThatAlwaysFails, toError);
    repeatUntil(() => taskThatAlwaysFails, blockAfterAttempts).fold(
      _ => fail("should never fail here"),
      r => {
        expect(r).toBe(RESOLVE_VALUE);
        expect(fnThatAlwaysFails).toBeCalledTimes(MAX_REPEAT_TIMES - 1);
      }
    );
  });
});

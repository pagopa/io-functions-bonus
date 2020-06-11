import { TaskEither } from "fp-ts/lib/TaskEither";

export const MAX_REPEAT_TIMES = 5;

export const alwaysRepeat = () => true;
export const neverRepeat = () => false;
// tslint:disable-next-line: no-parameter-reassignment
export const repeatTimes = (n: number) => () => --n > 0;

/**
 * Execute a task until either succeeed or meet the expected condition. Default condition is: it reached max attempts numbers
 * @param lazyTaskEither a function that returns the taskEither to be executed
 * @param shouldRepeat (optional) a function that is executed at each failure to decide whether to repet or not
 *
 * @returns the very first taskEither provided by lazyTaskEither that either succeeds or doesn't meet the repeat condition
 */
export const repeatUntil = <L, R>(
  lazyTaskEither: () => TaskEither<L, R>,
  shouldRepeat: (l: L) => boolean = repeatTimes(MAX_REPEAT_TIMES)
): TaskEither<L, R> => {
  const te = lazyTaskEither();
  return te.foldTaskEither<L, R>(
    l => (shouldRepeat(l) ? repeatUntil(lazyTaskEither, shouldRepeat) : te),
    _ => te
  );
};

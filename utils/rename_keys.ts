// tslint:disable: no-any

import { isObject } from "italia-ts-commons/lib/types";
import { isArray } from "util";

function renameObjectKeys_(obj: any, fn: (s: string) => string): any {
  return Object.keys(obj).reduce(
    (prev: any, cur: string) => ({ ...prev, [fn(cur)]: obj[cur] }),
    {}
  );
}

export function renameObjectKeys(obj: any, fn: (s: string) => string): any {
  if (isObject(obj)) {
    const renamed = renameObjectKeys_(obj, fn);
    return Object.keys(renamed).reduce((prev: any, cur: string) => {
      const val = renamed[cur];
      return {
        ...prev,
        [cur]: !isObject(val) && !isArray(val) ? val : renameObjectKeys(val, fn)
      };
    }, {});
  } else if (isArray(obj)) {
    return obj.map(v => renameObjectKeys(v, fn));
  }
  return obj;
}

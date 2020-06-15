import { isObject } from "italia-ts-commons/lib/types";
import { isArray } from "util";

/**
 * Rename the keys of obj according to the function fn
 */
export function renameObjectKeys(
  obj: unknown,
  fn: (s: string) => string
): typeof obj {
  if (typeof obj === "object" && obj !== null && isObject(obj)) {
    const keys = Object.keys(obj);
    return keys.reduce((prev: object, k: string) => {
      const originalValue = (obj as Record<string, unknown>)[k];
      const renamedValue =
        (typeof originalValue === "object" &&
          originalValue !== null &&
          isObject(originalValue)) ||
        isArray(originalValue)
          ? renameObjectKeys(originalValue, fn)
          : originalValue;
      return {
        ...prev,
        [fn(k)]: renamedValue
      };
    }, {});
  }

  if (isArray(obj)) {
    return obj.map(v => renameObjectKeys(v, fn));
  }

  return obj;
}

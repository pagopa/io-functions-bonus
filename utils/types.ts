/**
 * Type-safe implementation for Object.keys()
 * @param o the object to get the keys from
 *
 * @returns the keys of the provided object
 */
export function keys<T>(o: T): ReadonlyArray<keyof T> {
  return (Object.keys(o) as unknown) as ReadonlyArray<keyof T>;
}

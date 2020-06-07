export function snakeCaseToCamelCase(s: string): string {
  return s.replace(/(\_\w)/g, (m: string) => {
    return m[1].toUpperCase();
  });
}

export function camelCaseToSnakeCase(s: string): string {
  return s.replace(/(.)([A-Z]+)/g, (_, previous, uppers) => {
    return `${previous}_${uppers
      .toLowerCase()
      .split("")
      .join("_")}`;
  });
}

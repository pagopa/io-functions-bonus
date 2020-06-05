import * as crypto from "crypto";

export const toHash = (s: string): string => {
  const hash = crypto.createHash("sha256");
  hash.update(s);
  return hash.digest("hex");
};

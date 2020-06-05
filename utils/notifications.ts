import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";
import { FiscalCode } from "italia-ts-commons/lib/strings";

/**
 * Send a message to the user that matches the provided fiscal code
 * using the IO Notification API (REST).
 */
export async function sendMessage(
  fiscalCode: FiscalCode,
  apiUrl: string,
  apiKey: string,
  newMessage: NewMessage,
  timeoutFetch: typeof fetch
): Promise<number> {
  const response = await timeoutFetch(
    `${apiUrl}/api/v1/messages/${fiscalCode}`,
    {
      body: JSON.stringify(newMessage),
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": apiKey
      },
      method: "POST"
    }
  );
  return response.status;
}

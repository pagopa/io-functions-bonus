import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";

export const makeNewMessage = (content: MessageContent) =>
  NewMessage.decode({
    content
  }).getOrElseL(errs => {
    throw new Error("Invalid MessageContent: " + readableReport(errs));
  });

/**
 * Get the user profile that matches the provided fiscal code
 * using the IO Notification API (REST).
 * Returns the status of the response.
 */
export const getGetProfile = (
  apiUrl: string,
  apiKey: string,
  timeoutFetch: typeof fetch
) => async (fiscalCode: FiscalCode): Promise<number> => {
  const response = await timeoutFetch(
    `${apiUrl}/api/v1/profiles/${fiscalCode}`,
    {
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": apiKey
      },
      method: "GET"
    }
  );

  return response.status;
};

export type GetProfileT = ReturnType<typeof getGetProfile>;

/**
 * Send a message to the user that matches the provided fiscal code
 * using the IO Notification API (REST).
 */
export const getSendMessage = (
  apiUrl: string,
  apiKey: string,
  timeoutFetch: typeof fetch
) => async (
  fiscalCode: FiscalCode,
  newMessage: NewMessage
): Promise<number> => {
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
};

export type SendMessageT = ReturnType<typeof getSendMessage>;

import { context } from "../../__mocks__/durable-functions";
import { aFiscalCode, aMessageContent } from "../../__mocks__/mocks";
import { getSendMessageActivityHandler } from "../handler";

const messageOkStatusCode = 201;
const profileOkStatusCode = 200;
const profileNotFoundStatusCode = 404;
const profileQueryExceptionStatusCode = 500;
const profileQueryFailureStatusCode = 300; // any code
const messageQueryExceptionStatusCode = 500;
const messageQueryFailureStatusCode = 300; //  any code

const mockGetProfile = jest.fn(async () => profileOkStatusCode);
const mockSendMessage = jest.fn(async () => messageOkStatusCode);

describe("getSendMessageActivityHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail on invalid input", async () => {
    const input = "invalid";

    const handler = getSendMessageActivityHandler(
      mockGetProfile,
      mockSendMessage
    );

    const result = await handler(context, input);

    expect(result.kind).toBe("FAILURE");
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should succeeed when message is created without check profile", async () => {
    const handler = getSendMessageActivityHandler(
      mockGetProfile,
      mockSendMessage
    );

    const result = await handler(context, {
      checkProfile: false,
      content: aMessageContent,
      fiscalCode: aFiscalCode
    });

    expect(result.kind).toBe("SUCCESS");
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalled();
  });

  it("should succeeed when no profile is found", async () => {
    mockGetProfile.mockReturnValueOnce(
      Promise.resolve(profileNotFoundStatusCode)
    );

    const handler = getSendMessageActivityHandler(
      mockGetProfile,
      mockSendMessage
    );

    const result = await handler(context, {
      checkProfile: true,
      content: aMessageContent,
      fiscalCode: aFiscalCode
    });

    expect(result.kind).toBe("SUCCESS");
    expect(mockGetProfile).toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should succeeed when no profile is found and a message is sent", async () => {
    const handler = getSendMessageActivityHandler(
      mockGetProfile,
      mockSendMessage
    );

    const result = await handler(context, {
      checkProfile: true,
      content: aMessageContent,
      fiscalCode: aFiscalCode
    });

    expect(result.kind).toBe("SUCCESS");
    expect(mockGetProfile).toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalled();
  });

  it("should fail when getProfile fails", async () => {
    mockGetProfile.mockReturnValueOnce(
      Promise.resolve(profileQueryFailureStatusCode)
    );

    const handler = getSendMessageActivityHandler(
      mockGetProfile,
      mockSendMessage
    );

    const result = await handler(context, {
      checkProfile: true,
      content: aMessageContent,
      fiscalCode: aFiscalCode
    });

    expect(result.kind).toBe("FAILURE");
    expect(mockGetProfile).toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should throw when getProfile has a query exception", async () => {
    mockGetProfile.mockReturnValueOnce(
      Promise.resolve(profileQueryExceptionStatusCode)
    );

    const handler = getSendMessageActivityHandler(
      mockGetProfile,
      mockSendMessage
    );

    try {
      await handler(context, {
        checkProfile: true,
        content: aMessageContent,
        fiscalCode: aFiscalCode
      });
      fail();
    } catch (_) {
      expect(mockGetProfile).toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    }
  });

  it.each`
    title                      | withCheckProfile
    ${"with profile check"}    | ${true}
    ${"without profile check"} | ${false}
  `(
    "should throw when sendMessage has a query exception $title",
    async ({ withCheckProfile }) => {
      mockSendMessage.mockReturnValueOnce(
        Promise.resolve(messageQueryExceptionStatusCode)
      );

      const handler = getSendMessageActivityHandler(
        mockGetProfile,
        mockSendMessage
      );

      try {
        await handler(context, {
          checkProfile: withCheckProfile,
          content: aMessageContent,
          fiscalCode: aFiscalCode
        });
        fail();
      } catch (_) {
        expect(mockGetProfile).toHaveBeenCalledTimes(withCheckProfile ? 1 : 0);
        expect(mockSendMessage).toHaveBeenCalled();
      }
    }
  );

  it.each`
    title                      | withCheckProfile
    ${"with profile check"}    | ${true}
    ${"without profile check"} | ${false}
  `(
    "should fail when sendMessage has a query failure $title",
    async ({ withCheckProfile }) => {
      mockSendMessage.mockReturnValueOnce(
        Promise.resolve(messageQueryFailureStatusCode)
      );

      const handler = getSendMessageActivityHandler(
        mockGetProfile,
        mockSendMessage
      );

      const result = await handler(context, {
        checkProfile: withCheckProfile,
        content: aMessageContent,
        fiscalCode: aFiscalCode
      });

      expect(result.kind).toBe("FAILURE");
      expect(mockGetProfile).toHaveBeenCalledTimes(withCheckProfile ? 1 : 0);
      expect(mockSendMessage).toHaveBeenCalled();
    }
  );
});

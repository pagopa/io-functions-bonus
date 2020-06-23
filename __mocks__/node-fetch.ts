export const mockJsonBody = { foo: "bar" };
export const mockTextBody = "foobar";

const getMockResponse = (): Response =>
  (({
    clone: jest.fn(getMockResponse),
    json: jest.fn(async () => mockJsonBody),
    status: 100,
    text: jest.fn(async () => mockTextBody)
  } as unknown) as Response);

export const mockResponse: Response = getMockResponse();

const mockFetch = jest
  .fn()
  .mockImplementation(
    async (input: RequestInfo, init?: RequestInit) => mockResponse
  );

export default mockFetch;

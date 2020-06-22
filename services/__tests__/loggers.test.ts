import { logHttpFetch } from "../loggers";

describe("logHttpFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute the original fetch", async () => {
    const mockBody = { foo: "bar" };
    const getMockResponse = () => ({
      clone: getMockResponse,
      json: jest.fn(async () => mockBody)
    });
    const mockFetch = jest
      .fn()
      .mockImplementation(async () => getMockResponse());

    const mockTraceFn = jest.fn(async () => void 0);

    const wrappedFetch = logHttpFetch(mockTraceFn)(mockFetch);

    const input = "anyUrl";
    const init = { headers: { header: "value" } };
    const res = await wrappedFetch(input, init);

    expect(mockFetch).toBeCalledWith(input, init);
    expect(await res.json()).toEqual(mockBody);
  });

  it("should execute the tracer function", async () => {
    const mockBody = { foo: "bar" };
    const getMockResponse = () => ({
      clone: getMockResponse,
      json: jest.fn(async () => mockBody)
    });
    const mockFetch = jest
      .fn()
      .mockImplementation(async () => getMockResponse());

    const mockTraceFn = jest.fn(async () => void 0);

    const wrappedFetch = logHttpFetch(mockTraceFn)(mockFetch);

    const input = "anyUrl";
    const init = { headers: { header: "value" } };
    const res = await wrappedFetch(input, init);

    expect(mockTraceFn).toBeCalledWith(input, init, expect.any(Object));
    expect(res.json).not.toHaveBeenCalled();
  });

  it("should ignore tracing exception", async () => {
    const mockBody = { foo: "bar" };
    const getMockResponse = () => ({
      clone: getMockResponse,
      json: jest.fn(async () => mockBody)
    });
    const mockFetch = jest
      .fn()
      .mockImplementation(async () => getMockResponse());

    const mockTraceFn = jest.fn(async () => {
      throw new Error();
    });

    const wrappedFetch = logHttpFetch(mockTraceFn)(mockFetch);

    const input = "anyUrl";
    const init = { headers: { header: "value" } };
    await wrappedFetch(input, init);

    expect(mockFetch).toBeCalledWith(input, init);
  });

  it("should not hide fetch exception", async () => {
    const mockBody = { foo: "bar" };
    const getMockResponse = () => ({
      clone: getMockResponse,
      json: jest.fn(async () => mockBody)
    });
    const mockFetchException = new Error("fetch error");
    const mockFetch = jest.fn().mockImplementation(async () => {
      throw mockFetchException;
    });

    const mockTraceFn = jest.fn(async () => void 0);

    const wrappedFetch = logHttpFetch(mockTraceFn)(mockFetch);

    const input = "anyUrl";
    const init = { headers: { header: "value" } };
    try {
      await wrappedFetch(input, init);
      fail("should not pass here");
    } catch (ex) {
      expect(ex).toEqual(mockFetchException);
    }
  });
});

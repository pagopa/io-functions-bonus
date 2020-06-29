import mockFetch, { mockJsonBody } from "../../__mocks__/node-fetch";
import { extractFiscalCode, logHttpFetch } from "../loggers";

describe("logHttpFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute the original fetch", async () => {
    const mockTraceFn = jest.fn(async () => void 0);

    const wrappedFetch = logHttpFetch(mockTraceFn)(mockFetch);

    const input = "anyUrl";
    const init = { headers: { header: "value" } };
    const res = await wrappedFetch(input, init);

    expect(mockFetch).toBeCalledWith(input, init);
    expect(await res.json()).toEqual(mockJsonBody);
  });

  it("should execute the tracer function", async () => {
    const mockTraceFn = jest.fn(async () => void 0);

    const wrappedFetch = logHttpFetch(mockTraceFn)(mockFetch);

    const input = "anyUrl";
    const init = { headers: { header: "value" } };
    const res = await wrappedFetch(input, init);

    expect(mockTraceFn).toBeCalledWith(input, init, expect.any(Object));
    expect(res.json).not.toHaveBeenCalled();
  });

  it("should ignore tracing exception", async () => {
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
    const mockFetchException = new Error("fetch error");
    mockFetch.mockImplementationOnce(async () => {
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

  it("should extract fiscal code from payload", () => {
    const payload =
      '"{"codiceBuono":"XXXXXXXXXX","codiceFiscaleDichiarante":"AAAAAA00A00A000D"}';
    const res = extractFiscalCode(payload).getOrElseL(() => fail());
    expect(res).toEqual("AAAAAA00A00A000D");
  });
  it("should not extract fiscal code from payload", () => {
    const payload =
      '"{"codiceBuono":"XXXXXXXXXX","codiceFiscaleDichiarante":"1234"}';
    const res = extractFiscalCode(payload).getOrElseL(() => "foobar");
    expect(res).toEqual("foobar");
  });
});

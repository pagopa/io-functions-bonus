import * as SwaggerParser from "swagger-parser";

describe("API specs", () => {
  const specFilePath = `${__dirname}/../openapi/index.yaml`;

  it("should be valid", async () => {
    const api = await SwaggerParser.validate(specFilePath);
    expect(api).toBeDefined();
  });
});

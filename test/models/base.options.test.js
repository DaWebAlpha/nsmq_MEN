
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
  config: {
    node_env: "development",
  },
}));

const { baseOptions } = await import("../../backend/src/models/base.options.js");

describe("Testing for base configurations", () => {
  beforeEach(() => {
    // nothing to reset for now, kept for consistency
  });

  it("should return true for strict", () => {
    expect(typeof baseOptions.strict).toBe("boolean");
    expect(baseOptions.strict).toBe(true);
    expect(baseOptions.strict).toBeDefined();
  });

  it("should return true for strictQuery", () => {
    expect(typeof baseOptions.strictQuery).toBe("boolean");
    expect(baseOptions.strictQuery).toBe(true);
    expect(baseOptions.strictQuery).toBeDefined();
  });

  it("should return true for timestamps", () => {
    expect(typeof baseOptions.timestamps).toBe("boolean");
    expect(baseOptions.timestamps).toBe(true);
    expect(baseOptions.timestamps).toBeDefined();
  });

  it("should enable autoIndex in development", () => {
    expect(baseOptions.autoIndex).toBe(true);
  });

  it("should return true for virtuals in toJSON", () => {
    expect(baseOptions.toJSON.virtuals).toBe(true);
  });

  it("should return true for getters in toJSON", () => {
    expect(baseOptions.toJSON.getters).toBe(true);
  });

  it("should define a transform function in toJSON", () => {
    expect(typeof baseOptions.toJSON.transform).toBe("function");
  });

  it("should return true for virtuals in toObject", () => {
    expect(baseOptions.toObject.virtuals).toBe(true);
  });

  it("should return true for getters in toObject", () => {
    expect(baseOptions.toObject.getters).toBe(true);
  });

  it("should define a transform function in toObject", () => {
    expect(typeof baseOptions.toObject.transform).toBe("function");
  });

  it("should return true for id", () => {
    expect(baseOptions.id).toBe(true);
  });

  it("should remove password from transformed object", () => {
    const ret = {
      password: "secret123",
      username: "kashi",
    };

    const result = baseOptions.toJSON.transform({}, ret);

    expect(result.password).toBeUndefined();
    expect(result.username).toBe("kashi");
  });

  it("should add id from _id when transforming", () => {
    const ret = {
      _id: {
        toString: () => "abc123",
      },
      username: "kashi",
    };

    const result = baseOptions.toJSON.transform({}, ret);

    expect(result.id).toBe("abc123");
    expect(result.username).toBe("kashi");
  });

  it("should remove internal version and token fields", () => {
    const ret = {
      _id: {
        toString: () => "abc123",
      },
      __version: 1,
      __v: 2,
      __token: "token123",
      __hashToken: "hash123",
      email: "test@example.com",
    };

    const result = baseOptions.toJSON.transform({}, ret);

    expect(result.__version).toBeUndefined();
    expect(result.__v).toBeUndefined();
    expect(result.__token).toBeUndefined();
    expect(result.__hashToken).toBeUndefined();
    expect(result.email).toBe("test@example.com");
    expect(result.id).toBe("abc123");
  });

  it("should work safely when ret is missing password and _id", () => {
    const ret = {
      email: "test@example.com",
    };

    const result = baseOptions.toJSON.transform({}, ret);

    expect(result.email).toBe("test@example.com");
    expect(result.password).toBeUndefined();
    expect(result.id).toBeUndefined();
  });

  it("should return the same transformed behavior for toObject", () => {
    const ret = {
      _id: {
        toString: () => "obj123",
      },
      password: "secret",
      __v: 1,
      __token: "token",
      profile: "student",
    };

    const result = baseOptions.toObject.transform({}, ret);

    expect(result.id).toBe("obj123");
    expect(result.password).toBeUndefined();
    expect(result.__v).toBeUndefined();
    expect(result.__token).toBeUndefined();
    expect(result.profile).toBe("student");
  });
});
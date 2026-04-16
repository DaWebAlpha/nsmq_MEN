import { jest, describe, it, expect, beforeEach } from "@jest/globals";

/* ---------------- GLOBAL MOCKS ---------------- */

const mockPinoInstance = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockPino = jest.fn(() => mockPinoInstance);
const mockTransport = jest.fn();

const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockJoin = jest.fn();

/* ---------------- HELPERS ---------------- */

const loadModule = async (env = "development", logExists = true) => {
  jest.resetModules();

  mockExistsSync.mockReturnValue(logExists);
  mockJoin.mockImplementation((...args) => args.join("/"));
  mockTransport.mockReturnValue("transport");

  jest.unstable_mockModule("pino", () => ({
    default: Object.assign(mockPino, {
      transport: mockTransport,
      stdTimeFunctions: {
        isoTime: "iso-time",
      },
    }),
  }));

  jest.unstable_mockModule("node:fs", () => ({
    default: {
      existsSync: mockExistsSync,
      mkdirSync: mockMkdirSync,
    },
  }));

  jest.unstable_mockModule("node:path", () => ({
    default: {
      join: mockJoin,
    },
  }));

  jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
    config: {
      node_env: env,
    },
  }));

  return await import("@backend/src/core/pino.logger.js");
};

/* ---------------- it SUITE ---------------- */

describe("Enterprise Pino Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ================= FILESYSTEM ================= */

  it("should create logs directory if missing", async () => {
    await loadModule("development", false);

    expect(mockExistsSync).toHaveBeenCalledWith("./logs");
    expect(mockMkdirSync).toHaveBeenCalledWith("./logs", {
      recursive: true,
    });
  });

  it("should not recreate logs directory if exists", async () => {
    await loadModule("development", true);

    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  /* ================= ENV LOG LEVEL ================= */

  it("should use debug level in development", async () => {
    await loadModule("development");

    const configArg = mockPino.mock.calls[0][0];
    expect(configArg.level).toBe("debug");
  });

  it("should use info level in production", async () => {
    await loadModule("production");

    const configArg = mockPino.mock.calls[0][0];
    expect(configArg.level).toBe("info");
  });

  /* ================= REDACTION (CRITICAL) ================= */

  it("should include sensitive fields in redact config", async () => {
    await loadModule();

    const redact = mockPino.mock.calls[0][0].redact;

    expect(redact.paths).toEqual(
      expect.arrayContaining([
        "password",
        "*.password",
        "token",
        "*.token",
        "access_token",
        "refresh_token",
        "req.headers.authorization",
        "req.headers.cookie",
      ])
    );

    expect(redact.remove).toBe(true);
  });

  /* ================= MIXIN ================= */

  it("should map log levels correctly", async () => {
    await loadModule();

    const mixin = mockPino.mock.calls[0][0].mixin;

    expect(mixin({}, 10)).toEqual({ level_label: "trace" });
    expect(mixin({}, 20)).toEqual({ level_label: "debug" });
    expect(mixin({}, 30)).toEqual({ level_label: "info" });
    expect(mixin({}, 40)).toEqual({ level_label: "warn" });
    expect(mixin({}, 50)).toEqual({ level_label: "error" });
    expect(mixin({}, 60)).toEqual({ level_label: "fatal" });
    expect(mixin({}, 999)).toEqual({ level_label: "info" }); // fallback
  });

  /* ================= TRANSPORT ================= */

  it("should configure 3 transports (system, audit, access)", async () => {
    await loadModule();

    expect(mockTransport).toHaveBeenCalledTimes(3);
  });

  it("should include pino-pretty in development", async () => {
    await loadModule("development");

    const transportConfig = mockTransport.mock.calls[0][0];

    const hasPretty = transportConfig.targets.some(
      (t) => t.target === "pino-pretty"
    );

    expect(hasPretty).toBe(true);
  });

  it("should NOT include pino-pretty in production", async () => {
    await loadModule("production");

    const transportConfig = mockTransport.mock.calls[0][0];

    const hasPretty = transportConfig.targets.some(
      (t) => t.target === "pino-pretty"
    );

    expect(hasPretty).toBe(false);
  });

  /* ================= FILE PATHS ================= */

  it("should generate correct log file paths", async () => {
    await loadModule();

    expect(mockJoin).toHaveBeenCalledWith("./logs", "system/app-info");
    expect(mockJoin).toHaveBeenCalledWith("./logs", "errors/app-error");
    expect(mockJoin).toHaveBeenCalledWith("./logs", "audit/app-audit");
    expect(mockJoin).toHaveBeenCalledWith("./logs", "access/app-access");
  });

  /* ================= LOGGER CREATION ================= */

  it("should create 3 logger instances", async () => {
    const module = await loadModule();

    expect(module.system_logger).toBeDefined();
    expect(module.audit_logger).toBeDefined();
    expect(module.access_logger).toBeDefined();

    expect(mockPino).toHaveBeenCalledTimes(3);
  });

  /* ================= STRUCTURE VALIDATION ================= */

  it("should pass transport into pino", async () => {
    await loadModule();

    const secondArg = mockPino.mock.calls[0][1];

    expect(secondArg).toBe("transport");
  });

  /* ================= SECURITY EDGE ================= */

  it("redact should REMOVE sensitive fields (not mask)", async () => {
    await loadModule();

    const redact = mockPino.mock.calls[0][0].redact;

    expect(redact.remove).toBe(true);
  });
});
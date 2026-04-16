import { jest, describe, test, expect, beforeEach } from "@jest/globals";

/* ---------------- MOCK FUNCTIONS ---------------- */

const mockConnect = jest.fn();
const mockOn = jest.fn();

const mockLoggerError = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

/* ---------------- MOCK ERROR ---------------- */

class MockAppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/* ---------------- MOCK MODULES ---------------- */

jest.unstable_mockModule("mongoose", () => ({
  default: {
    connect: mockConnect,
    connection: {
      on: mockOn,
    },
  },
}));

jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
  config: {
    mongo_uri: "mongodb://localhost:27017/test",
  },
}));

jest.unstable_mockModule("../../backend/src/errors/app.error.js", () => ({
  AppError: MockAppError,
}));

jest.unstable_mockModule("../../backend/src/core/pino.logger.js", () => ({
  system_logger: {
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
  },
}));

/* ---------------- IMPORTS (AFTER MOCKS) ---------------- */

const { default: mongoose } = await import("mongoose");
const { system_logger } = await import(
  "../../backend/src/core/pino.logger.js"
);
const { AppError } = await import(
  "../../backend/src/errors/app.error.js"
);

const { connectDB } = await import(
  "@backend/src/core/mongoose.database.js"
);

/* ---------------- TESTS ---------------- */

describe("connectDB", () => {
  beforeEach(() => {
    // ✅ DO NOT clear mockOn (it was used during import)
    mockConnect.mockClear();
    mockLoggerError.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
  });

  test("should connect to MongoDB successfully", async () => {
    mockConnect.mockResolvedValue(true);

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(mongoose.connect).toHaveBeenCalledWith(
      "mongodb://localhost:27017/test",
      {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    );

    expect(system_logger.info).toHaveBeenCalledWith(
      "MongoDB connected successfully"
    );
  });

  test("should throw AppError if MONGO_URI is missing", async () => {
    jest.resetModules();

    jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
      config: {
        mongo_uri: "",
      },
    }));

    const { connectDB: freshConnect } = await import(
      "@backend/src/core/mongoose.database.js"
    );

    await expect(freshConnect()).rejects.toBeInstanceOf(AppError);
    await expect(freshConnect()).rejects.toThrow(
      "MONGO_URI is not defined in environment variables"
    );

    expect(system_logger.error).toHaveBeenCalledWith(
      "MONGO_URI is not defined in environment variables"
    );
  });

  test("should log error and throw AppError if connection fails", async () => {
    const dbError = new Error("connection failed");
    mockConnect.mockRejectedValue(dbError);

    await expect(connectDB()).rejects.toBeInstanceOf(AppError);
    await expect(connectDB()).rejects.toThrow(
      "Failed to connect to MongoDB"
    );

    expect(system_logger.error).toHaveBeenCalledWith(
      "Failed to connect to MongoDB",
      { error: "connection failed" }
    );
  });

  test("should register mongoose event listeners", () => {
    expect(mockOn).toHaveBeenCalledWith(
      "disconnected",
      expect.any(Function)
    );

    expect(mockOn).toHaveBeenCalledWith(
      "error",
      expect.any(Function)
    );
  });

  test("should log warning on disconnected event", () => {
    const call = mockOn.mock.calls.find(
      ([event]) => event === "disconnected"
    );

    expect(call).toBeDefined();

    const handler = call[1];
    handler();

    expect(system_logger.warn).toHaveBeenCalledWith(
      "MongoDB connection lost"
    );
  });

  test("should log error on connection error event", () => {
    const call = mockOn.mock.calls.find(
      ([event]) => event === "error"
    );

    expect(call).toBeDefined();

    const handler = call[1];
    handler(new Error("db crash"));

    expect(system_logger.error).toHaveBeenCalledWith(
      "MongoDB connection error",
      { error: "db crash" }
    );
  });
});
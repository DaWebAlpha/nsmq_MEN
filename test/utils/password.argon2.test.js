import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockHash = jest.fn();
const mockVerify = jest.fn();
const mockLoggerError = jest.fn();

class MockAppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

jest.unstable_mockModule("argon2", () => ({
  default: {
    argon2id: 2,
    hash: mockHash,
    verify: mockVerify,
  },
}));

// ✅ MUST MATCH EXACT PATH USED IN FILE
jest.unstable_mockModule("../../backend/src/core/pino.logger.js", () => ({
  system_logger: {
    error: mockLoggerError,
  },
}));

jest.unstable_mockModule("../../backend/src/errors/app.error.js", () => ({
  AppError: MockAppError,
}));

const { default: argon2 } = await import("argon2");
const { system_logger } = await import("../../backend/src/core/pino.logger.js");
const { AppError } = await import("../../backend/src/errors/app.error.js");
const { hashPassword, verifyPassword } = await import(
  "@backend/src/utils/password.argon2.js"
);

describe("Password Utility", () => {
  const ARGON_CONFIG = {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 2,
    hashLength: 32,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("hashPassword", () => {
    test("should return null if input is not a string", async () => {
      const result = await hashPassword(123);

      expect(result).toBeNull();
      expect(mockHash).not.toHaveBeenCalled();
    });

    test("should throw AppError for empty password", async () => {
      await expect(hashPassword("   ")).rejects.toBeInstanceOf(AppError);
      await expect(hashPassword("   ")).rejects.toThrow("Invalid password input");

      expect(mockHash).not.toHaveBeenCalled();
    });

    test("should throw AppError for short password", async () => {
      await expect(hashPassword("short")).rejects.toBeInstanceOf(AppError);
      await expect(hashPassword("short")).rejects.toThrow(
        "Password must be at least 8 characters long"
      );

      expect(mockHash).not.toHaveBeenCalled();
    });

    test("should hash password successfully", async () => {
      mockHash.mockResolvedValue("mocked_hash");

      const result = await hashPassword("validPassword123");

      expect(result).toBe("mocked_hash");
      expect(mockHash).toHaveBeenCalledTimes(1);
      expect(mockHash).toHaveBeenCalledWith("validPassword123", ARGON_CONFIG);
    });

    test("should trim password before hashing", async () => {
      mockHash.mockResolvedValue("mocked_hash");

      await hashPassword("   validPassword123   ");

      expect(mockHash).toHaveBeenCalledWith("validPassword123", ARGON_CONFIG);
    });

    test("should log error and throw AppError if hashing fails", async () => {
      mockHash.mockRejectedValue(new Error("argon fail"));

      await expect(hashPassword("validPassword123")).rejects.toBeInstanceOf(AppError);
      await expect(hashPassword("validPassword123")).rejects.toThrow(
        "Internal security error"
      );

      expect(system_logger.error).toHaveBeenCalledWith(
        { error: "argon fail" },
        "Security: Password hashing failed"
      );
    });
  });

  describe("verifyPassword", () => {
    test("should return false for invalid inputs", async () => {
      expect(await verifyPassword(null, "hash")).toBe(false);
      expect(await verifyPassword("pass", null)).toBe(false);
      expect(await verifyPassword("", "hash")).toBe(false);

      expect(mockVerify).not.toHaveBeenCalled();
    });

    test("should return true for matching password", async () => {
      mockVerify.mockResolvedValue(true);

      const result = await verifyPassword("pass12345", "hash");

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalledWith("hash", "pass12345");
    });

    test("should trim password before verify", async () => {
      mockVerify.mockResolvedValue(true);

      await verifyPassword("   pass12345   ", "hash");

      expect(mockVerify).toHaveBeenCalledWith("hash", "pass12345");
    });

    test("should return false for mismatch", async () => {
      mockVerify.mockResolvedValue(false);

      const result = await verifyPassword("wrong", "hash");

      expect(result).toBe(false);
    });

    test("should log error and return false if verify fails", async () => {
      mockVerify.mockRejectedValue(new Error("verify fail"));

      const result = await verifyPassword("pass12345", "hash");

      expect(result).toBe(false);
      expect(system_logger.error).toHaveBeenCalledWith(
        { error: "verify fail" },
        "Security: Password verification failed"
      );
    });
  });
});
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSign = jest.fn();
const mockVerify = jest.fn();
const mockLoggerError = jest.fn();
const mockCreate = jest.fn();
const mockHashToken = jest.fn();
const mockRandomBytes = jest.fn();

class MockAppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: mockSign,
    verify: mockVerify,
  },
}));

jest.unstable_mockModule("crypto", () => ({
  default: {
    randomBytes: mockRandomBytes,
  },
}));

jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
  config: {
    jwt_access_secret: "test-access-secret",
  },
}));

jest.unstable_mockModule("../../backend/src/core/pino.logger.js", () => ({
  system_logger: {
    error: mockLoggerError,
  },
}));

jest.unstable_mockModule("../../backend/src/errors/app.error.js", () => ({
  AppError: MockAppError,
}));

jest.unstable_mockModule("../../backend/src/models/auth/refreshToken.model.js", () => ({
  RefreshToken: {
    create: mockCreate,
    hashToken: mockHashToken,
  },
}));

const { default: jwt } = await import("jsonwebtoken");
const { default: crypto } = await import("crypto");
const { system_logger } = await import("../../backend/src/core/pino.logger.js");
const { AppError } = await import("../../backend/src/errors/app.error.js");
const { RefreshToken } = await import("../../backend/src/models/auth/refreshToken.model.js");
const {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
} = await import("@backend/src/utils/jwt.js");

describe("JWT Utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateAccessToken", () => {
    test("should generate access token with correct payload, secret, and expiry", () => {
      mockSign.mockReturnValue("mocked-access-token");

      const result = generateAccessToken("user123");

      expect(result).toBe("mocked-access-token");
      expect(jwt.sign).toHaveBeenCalledTimes(1);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "user123" },
        "test-access-secret",
        { expiresIn: 15 * 60 }
      );
    });

    test("should convert userId to string before signing", () => {
      mockSign.mockReturnValue("mocked-access-token");

      generateAccessToken(12345);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "12345" },
        "test-access-secret",
        { expiresIn: 15 * 60 }
      );
    });
  });

  describe("verifyAccessToken", () => {
    test("should verify token with correct secret", () => {
      const decodedPayload = { userId: "user123" };
      mockVerify.mockReturnValue(decodedPayload);

      const result = verifyAccessToken("valid-token");

      expect(result).toEqual(decodedPayload);
      expect(jwt.verify).toHaveBeenCalledTimes(1);
      expect(jwt.verify).toHaveBeenCalledWith(
        "valid-token",
        "test-access-secret"
      );
    });

    test("should throw when jwt.verify fails", () => {
      mockVerify.mockImplementation(() => {
        throw new Error("invalid token");
      });

      expect(() => verifyAccessToken("bad-token")).toThrow("invalid token");
      expect(jwt.verify).toHaveBeenCalledWith(
        "bad-token",
        "test-access-secret"
      );
    });
  });

  describe("generateRefreshToken", () => {
    test("should throw AppError if userId is missing", async () => {
      await expect(
        generateRefreshToken({
          deviceId: "device-1",
        })
      ).rejects.toBeInstanceOf(AppError);

      await expect(
        generateRefreshToken({
          deviceId: "device-1",
        })
      ).rejects.toThrow("User ID is required to generate refresh token");

      expect(system_logger.error).toHaveBeenCalledWith(
        "Security Error: User ID is required to generate refresh token"
      );
      expect(crypto.randomBytes).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    test("should throw AppError if deviceId is missing", async () => {
      await expect(
        generateRefreshToken({
          userId: "user123",
        })
      ).rejects.toBeInstanceOf(AppError);

      await expect(
        generateRefreshToken({
          userId: "user123",
        })
      ).rejects.toThrow("Device ID is required to generate refresh token");

      expect(system_logger.error).toHaveBeenCalledWith(
        "Security Error: Device ID is required to generate refresh token"
      );
      expect(crypto.randomBytes).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    test("should throw AppError if deviceId is blank", async () => {
      await expect(
        generateRefreshToken({
          userId: "user123",
          deviceId: "   ",
        })
      ).rejects.toBeInstanceOf(AppError);

      await expect(
        generateRefreshToken({
          userId: "user123",
          deviceId: "   ",
        })
      ).rejects.toThrow("Device ID is required to generate refresh token");

      expect(system_logger.error).toHaveBeenCalledWith(
        "Security Error: Device ID is required to generate refresh token"
      );
      expect(crypto.randomBytes).not.toHaveBeenCalled();
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    test("should generate refresh token and save hashed token", async () => {
      const rawToken = "raw-refresh-token";
      const tokenHash = "hashed-refresh-token";

      mockRandomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue(rawToken),
      });
      mockHashToken.mockReturnValue(tokenHash);
      mockCreate.mockResolvedValue([{ _id: "refresh-id" }]);

      const beforeCall = Date.now();

      const result = await generateRefreshToken({
        userId: "user123",
        tokenVersion: 2,
        deviceName: "Chrome on Windows",
        deviceId: "device-123",
        userAgent: "Mozilla/5.0",
        ipAddress: "127.0.0.1",
      });

      const afterCall = Date.now();

      expect(result).toBe(rawToken);
      expect(crypto.randomBytes).toHaveBeenCalledTimes(1);
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(RefreshToken.hashToken).toHaveBeenCalledTimes(1);
      expect(RefreshToken.hashToken).toHaveBeenCalledWith(rawToken);

      expect(RefreshToken.create).toHaveBeenCalledTimes(1);

      const createCallArgs = mockCreate.mock.calls[0];
      const payloadArray = createCallArgs[0];
      const optionsObject = createCallArgs[1];

      expect(Array.isArray(payloadArray)).toBe(true);
      expect(payloadArray).toHaveLength(1);

      const savedDoc = payloadArray[0];

      expect(savedDoc.userId).toBe("user123");
      expect(savedDoc.tokenHash).toBe(tokenHash);
      expect(savedDoc.tokenVersion).toBe(2);
      expect(savedDoc.deviceName).toBe("Chrome on Windows");
      expect(savedDoc.deviceId).toBe("device-123");
      expect(savedDoc.userAgent).toBe("Mozilla/5.0");
      expect(savedDoc.ipAddress).toBe("127.0.0.1");
      expect(savedDoc.lastUsedAt).toBeInstanceOf(Date);
      expect(savedDoc.expiresAt).toBeInstanceOf(Date);

      const expiresAtTime = savedDoc.expiresAt.getTime();
      const minExpected = beforeCall + 7 * 24 * 60 * 60 * 1000;
      const maxExpected = afterCall + 7 * 24 * 60 * 60 * 1000;

      expect(expiresAtTime).toBeGreaterThanOrEqual(minExpected);
      expect(expiresAtTime).toBeLessThanOrEqual(maxExpected);

      expect(optionsObject).toEqual({});
    });

    test("should trim deviceId before saving", async () => {
      mockRandomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue("raw-refresh-token"),
      });
      mockHashToken.mockReturnValue("hashed-refresh-token");
      mockCreate.mockResolvedValue([{ _id: "refresh-id" }]);

      await generateRefreshToken({
        userId: "user123",
        deviceId: "   device-999   ",
      });

      const savedDoc = mockCreate.mock.calls[0][0][0];
      expect(savedDoc.deviceId).toBe("device-999");
    });

    test("should pass session option when session is provided", async () => {
      const session = { id: "mock-session" };

      mockRandomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue("raw-refresh-token"),
      });
      mockHashToken.mockReturnValue("hashed-refresh-token");
      mockCreate.mockResolvedValue([{ _id: "refresh-id" }]);

      await generateRefreshToken({
        userId: "user123",
        deviceId: "device-123",
        session,
      });

      expect(RefreshToken.create).toHaveBeenCalledTimes(1);
      expect(mockCreate.mock.calls[0][1]).toEqual({ session });
    });

    test("should use defaults for optional fields", async () => {
      mockRandomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue("raw-refresh-token"),
      });
      mockHashToken.mockReturnValue("hashed-refresh-token");
      mockCreate.mockResolvedValue([{ _id: "refresh-id" }]);

      await generateRefreshToken({
        userId: "user123",
        deviceId: "device-123",
      });

      const savedDoc = mockCreate.mock.calls[0][0][0];

      expect(savedDoc.tokenVersion).toBe(0);
      expect(savedDoc.deviceName).toBe("");
      expect(savedDoc.userAgent).toBeNull();
      expect(savedDoc.ipAddress).toBeNull();
    });
  });
});
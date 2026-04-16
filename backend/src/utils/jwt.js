
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import { config } from "../config/config.js";
import { system_logger } from "../core/pino.logger.js";
import { RefreshToken } from "../models/auth/refreshToken.model.js";
import { AppError } from "../errors/app.error.js";

const JWT_ACCESS_SECRET = config.jwt_access_secret;

const JWT_ACCESS_EXPIRES_IN = 15 * 60; // 15 minutes
const JWT_REFRESH_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days


const generateAccessToken = (userId) => {
  return jwt.sign(
    {userId: String(userId)},
    JWT_ACCESS_SECRET,
    {expiresIn: JWT_ACCESS_EXPIRES_IN},
  )
}

const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_ACCESS_SECRET);
}


const generateRefreshToken = async ({
  userId,
  tokenVersion = 0,
  deviceName = "",
  deviceId,
  userAgent = null,
  ipAddress = null,
  session = null,
}) => {
  if (!userId) {
    system_logger.error("Security Error: User ID is required to generate refresh token");
    throw new AppError("User ID is required to generate refresh token", 400);
  }

  if (!deviceId || !String(deviceId).trim()) {
    system_logger.error("Security Error: Device ID is required to generate refresh token");
    throw new AppError("Device ID is required to generate refresh token", 400);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = RefreshToken.hashToken(rawToken);

  await RefreshToken.create(
    [
      {
        userId,
        tokenHash,
        tokenVersion,
        deviceName,
        deviceId: String(deviceId).trim(),
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + JWT_REFRESH_EXPIRES_IN),
        lastUsedAt: new Date(),
      },
    ],
    session ? { session } : {}
  );

  return rawToken;
};

export { generateAccessToken, verifyAccessToken, generateRefreshToken };
export default {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
}
import { userRepository } from "../../repositories/user.repository.js";
import { User } from "../../models/auth/user.model.js";
import { UserSecurity } from "../../models/auth/userSecurity.model.js";
import { RefreshToken } from "../../models/auth/refreshToken.model.js";
import { normalizeValue } from "../../utils/string.utils.js";
import { AppError } from "../../errors/app.error.js";
import { system_logger, audit_logger } from "../../core/pino.logger.js";
import { withTransaction } from "../../utils/db.transaction.js";
import { FailedLoginLogs } from "../../models/auth/failed.loginLogs.model.js";
import {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "../../utils/request.js";
import {
    generateAccessToken,
    generateRefreshToken,
} from "../../utils/jwt.js";

class AuthService {
    register = async (payload = {}, request) => {
        const username = normalizeValue(String(payload?.username ?? ""));
        const email = normalizeValue(String(payload?.email ?? ""));
        const password = String(payload?.password ?? "");

        if (!username) {
            system_logger.warn("Username creation failed");
            throw new AppError("Username is required", 400);
        }

        if (!email) {
            system_logger.warn("Email is required");
            throw new AppError("Email is required", 400);
        }

        if (!password) {
            system_logger.warn("Password is required");
            throw new AppError("Password is required", 400);
        }

        const [emailExists, usernameExists] = await Promise.all([
            userRepository.checkIfEmailExists(email),
            userRepository.checkIfUsernameExists(username),
        ]);

        if (usernameExists) {
            system_logger.warn("Username already exists");
            throw new AppError("Username already exists", 409);
        }

        if (emailExists) {
            system_logger.warn("Email already exists");
            throw new AppError("Email already exists", 409);
        }

        const deviceName = getDeviceName(request);
        const deviceId = getDeviceId(request);
        const userAgent = getUserAgent(request);
        const ipAddress = getClientIP(request);

        const result = await withTransaction(async (session) => {
            const user = await userRepository.create(
                {
                    username,
                    email,
                    password,
                    authProvider: "local",
                },
                { session }
            );

            const [userSecurity] = await UserSecurity.create(
                [
                    {
                        userId: user._id,
                        accountStatus: "active",
                    },
                ],
                { session }
            );

            const accessToken = generateAccessToken(user._id);

            const refreshToken = await generateRefreshToken({
                userId: user._id,
                deviceName,
                deviceId,
                userAgent,
                ipAddress,
                session,
            });

            audit_logger.info({
                userId: user._id,
                deviceId,
                message: "User created",
            });

            return {
                user,
                security: userSecurity,
                accessToken,
                refreshToken,
                message: "User registered successfully",
            };
        });

        return result;
    };

    login = async (payload = {}, request) => {
        const identifier = normalizeValue(String(payload?.identifier ?? ""));
        const password = String(payload?.password ?? "");

        const deviceName = getDeviceName(request);
        const deviceId = getDeviceId(request);
        const userAgent = getUserAgent(request);
        const ipAddress = getClientIP(request);

        if (!identifier || !password) {
            system_logger.warn("Enter either username or email and password");
            throw new AppError("Enter either username or email and password", 400);
        }

        const user = await userRepository.findByUsernameOrEmail(identifier);
        const security = await UserSecurity.findOne({ userId: user._id });

        if (!security) {
            system_logger.error("User security record not found");
            throw new AppError("Internal authentication error", 500);
        }

        if (security.isLocked) {
            audit_logger.error(
                {
                    userId: user._id,
                    username: user.username,
                    email: user.email,
                    deviceId,
                },
                "Account is locked"
            );
            throw new AppError(
                "Account is locked due to multiple failed login attempts. Please try again later.",
                403
            );
        }

        if (security.isBanned) {
            audit_logger.error(
                {
                    userId: user._id,
                    username: user.username,
                    email: user.email,
                    deviceId,
                },
                "Account is banned"
            );
            throw new AppError(
                "Account is banned. Please contact support for more information.",
                403
            );
        }

        if (security.isSuspended || security.accountStatus === "suspended") {
            audit_logger.error(
                {
                    userId: user._id,
                    username: user.username,
                    email: user.email,
                    deviceId,
                },
                "Account is temporarily suspended"
            );
            throw new AppError(
                "Account is temporarily suspended. Please try again later.",
                403
            );
        }

        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword) {
            await FailedLoginLogs.create({
                userId: user._id,
                ipAddress,
                userAgent,
                deviceName,
                reason: "invalid_password",
            });

            await security.incrementLoginAttempts();
            await security.save({ validateBeforeSave: false });

            system_logger.error("Invalid credentials entered");
            throw new AppError("Invalid credentials", 401);
        }

        await security.handleSuccessfulLoginAttempt();
        await security.save({ validateBeforeSave: false });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = await generateRefreshToken({
            userId: user._id,
            deviceName,
            deviceId,
            userAgent,
            ipAddress,
        });

        audit_logger.info({
            userId: user._id,
            deviceId,
            message: "User logged in successfully",
        });

        return {
            user,
            security,
            accessToken,
            refreshToken,
            message: "User logged in successfully",
        };
    };

    loginWithGoogle = async (payload = {}, request) => {
        const googleSub = String(payload?.googleSub ?? "").trim();
        const email = normalizeValue(String(payload?.email ?? ""));
        const usernameInput = normalizeValue(String(payload?.username ?? ""));
        const username = usernameInput || null;

        const deviceName = getDeviceName(request);
        const deviceId = getDeviceId(request);
        const userAgent = getUserAgent(request);
        const ipAddress = getClientIP(request);

        if (!googleSub) {
            system_logger.warn("Google sub is required for Google login");
            throw new AppError("Google sub is required for Google login", 400);
        }

        if (!email) {
            system_logger.warn("Google login requires an email");
            throw new AppError("Google login requires an email", 400);
        }

        const result = await withTransaction(async (session) => {
            let user = await User.findByGoogleSub(googleSub).session(session);
            let existingEmailUser = null;

            if (!user) {
                existingEmailUser = await User.findOne({
                    email,
                    isDeleted: false,
                }).session(session);
            }

            if (!user && existingEmailUser && existingEmailUser.authProvider !== "google") {
                throw new AppError(
                    "An account with this email already exists. Please log in with email and password.",
                    409
                );
            }

            if (!user && existingEmailUser && existingEmailUser.authProvider === "google") {
                existingEmailUser.googleSub = googleSub;

                if (!existingEmailUser.username && username) {
                    existingEmailUser.username = username;
                }

                user = await existingEmailUser.save({ session });
            }

            if (!user) {
                user = await userRepository.create(
                    {
                        username,
                        email,
                        authProvider: "google",
                        googleSub,
                    },
                    { session }
                );

                await UserSecurity.create(
                    [
                        {
                            userId: user._id,
                            accountStatus: "active",
                        },
                    ],
                    { session }
                );
            }

            const security = await UserSecurity.findOne({ userId: user._id }).session(session);

            if (!security) {
                system_logger.error("User security record not found");
                throw new AppError("Internal authentication error", 500);
            }

            if (security.isLocked) {
                audit_logger.error(
                    {
                        userId: user._id,
                        username: user.username,
                        email: user.email,
                        deviceId,
                    },
                    "Account is locked"
                );
                throw new AppError(
                    "Account is locked due to multiple failed login attempts. Please try again later.",
                    403
                );
            }

            if (security.isBanned) {
                audit_logger.error(
                    {
                        userId: user._id,
                        username: user.username,
                        email: user.email,
                        deviceId,
                    },
                    "Account is banned"
                );
                throw new AppError(
                    "Account is banned. Please contact support for more information.",
                    403
                );
            }

            if (security.isSuspended || security.accountStatus === "suspended") {
                audit_logger.error(
                    {
                        userId: user._id,
                        username: user.username,
                        email: user.email,
                        deviceId,
                    },
                    "Account is temporarily suspended"
                );
                throw new AppError(
                    "Account is temporarily suspended. Please try again later.",
                    403
                );
            }

            await security.handleSuccessfulLoginAttempt();
            await security.save({ validateBeforeSave: false, session });

            const accessToken = generateAccessToken(user._id);
            const refreshToken = await generateRefreshToken({
                userId: user._id,
                deviceName,
                deviceId,
                userAgent,
                ipAddress,
                session,
            });

            audit_logger.info({
                userId: user._id,
                deviceId,
                message: "User logged in with Google successfully",
            });

            return {
                user,
                security,
                accessToken,
                refreshToken,
                message: "Google login successful",
            };
        });

        return result;
    };

    refreshToken = async (payload = {}, request) => {
        const rawRefreshToken = String(payload?.refreshToken ?? "").trim();

        if (!rawRefreshToken) {
            system_logger.error("Refresh token is required");
            throw new AppError("Refresh token is required", 400);
        }

        const existingToken = await RefreshToken.findActiveByRawToken(rawRefreshToken);

        if (!existingToken) {
            system_logger.error("Invalid or expired refresh token");
            throw new AppError("Invalid or expired refresh token", 401);
        }

        const user = await User.findOne({
            _id: existingToken.userId,
            isDeleted: false,
        });

        if (!user) {
            await existingToken.revoke("user_not_found");
            throw new AppError("Invalid refresh token", 401);
        }

        const security = await UserSecurity.findOne({ userId: user._id });

        if (!security) {
            system_logger.error("User security record not found");
            throw new AppError("Internal authentication error", 500);
        }

        if (security.isLocked || security.isBanned || security.isSuspended) {
            await existingToken.revoke("security_restricted");
            throw new AppError("Account is not allowed to refresh session", 403);
        }

        await existingToken.revoke("rotated");

        const accessToken = generateAccessToken(user._id);
        const newRefreshToken = await generateRefreshToken({
            userId: user._id,
            tokenVersion: (existingToken.tokenVersion || 0) + 1,
            deviceName: existingToken.deviceName,
            deviceId: existingToken.deviceId,
            userAgent: existingToken.userAgent,
            ipAddress: getClientIP(request) || existingToken.ipAddress,
        });

        audit_logger.info({
            userId: user._id,
            deviceId: existingToken.deviceId,
            message: "Refresh token rotated successfully",
        });

        return {
            user,
            accessToken,
            refreshToken: newRefreshToken,
            message: "Token refreshed successfully",
        };
    };

    logout = async (payload = {}) => {
        const rawRefreshToken = String(payload?.refreshToken ?? "").trim();

        if (!rawRefreshToken) {
            system_logger.warn("Refresh token is required for logout");
            throw new AppError("Refresh token is required", 400);
        }

        const existingToken = await RefreshToken.findActiveByRawToken(rawRefreshToken);

        if (!existingToken) {
            return {
                message: "Logged out successfully",
            };
        }

        await existingToken.revoke("logout");

        audit_logger.info({
            userId: existingToken.userId,
            deviceId: existingToken.deviceId,
            message: "User logged out successfully",
        });

        return {
            message: "Logged out successfully",
        };
    };

    me = async (userId) => {
        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const user = await User.findOne({
            _id: userId,
            isDeleted: false,
        });

        if (!user) {
            throw new AppError("User not found", 404);
        }

        const security = await UserSecurity.findOne({ userId: user._id });

        return {
            user,
            security,
            message: "Current user fetched successfully",
        };
    };
}

const authService = new AuthService();

export { authService, AuthService };
export default authService;
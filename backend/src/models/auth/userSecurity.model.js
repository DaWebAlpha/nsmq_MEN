import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";
import { config } from "../../config/config.js";

const MAX_FAILED_ATTEMPTS = Number(config.max_failed_attempts) || 5;
const LOCK_DURATION = Number(config.lock_duration) || 15 * 60 * 1000;

const ACCOUNT_STATUSES = ["pending", "active", "suspended", "banned"];

const userSecurityDefinition = {
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"],
    },

    accountStatus: {
        type: String,
        enum: ACCOUNT_STATUSES,
        default: "pending",
        index: true,
    },

    banWarningCount: {
        type: Number,
        default: 0,
        min: [0, "Ban warning count cannot be negative"],
    },

    accountBanned: {
        type: Boolean,
        default: false,
        index: true,
    },

    timesAccountHasBeenBanned: {
        type: Number,
        default: 0,
        min: [0, "Ban count cannot be negative"],
        index: true,
    },

    bannedUntil: {
        type: Date,
        default: null,
        index: true,
    },

    loginAttempts: {
        type: Number,
        default: 0,
        min: [0, "Login attempts cannot be negative"],
        index: true,
    },

    lockUntil: {
        type: Date,
        default: null,
        index: true,
    },

    lastLoginAt: {
        type: Date,
        default: null,
        index: true,
    },
};

const UserSecurity = createBaseModel(
    "UserSecurity",
    userSecurityDefinition,
    (schema) => {
        /**
         * ONE SECURITY RECORD PER ACTIVE USER
         */
        schema.index(
            { userId: 1 },
            {
                unique: true,
                partialFilterExpression: {
                    isDeleted: false,
                },
            }
        );

        schema.index({ userId: 1, accountStatus: 1 });
        schema.index({ userId: 1, accountBanned: 1 });

        /**
         * Account is currently locked
         */
        schema.virtual("isLocked").get(function () {
            return Boolean(
                this.lockUntil instanceof Date &&
                    this.lockUntil.getTime() > Date.now()
            );
        });

        /**
         * Account is currently banned or temporarily suspended
         */
        schema.virtual("isBanned").get(function () {
            return Boolean(
                this.accountBanned ||
                    (this.bannedUntil instanceof Date &&
                        this.bannedUntil.getTime() > Date.now())
            );
        });

        /**
         * Account is currently temporarily suspended
         */
        schema.virtual("isSuspended").get(function () {
            return Boolean(
                !this.accountBanned &&
                    this.bannedUntil instanceof Date &&
                    this.bannedUntil.getTime() > Date.now()
            );
        });

        /**
         * Normalize counters and cleanup expired temporary suspensions
         */
        schema.pre("validate", function () {
            if (this.loginAttempts < 0) {
                this.loginAttempts = 0;
            }

            if (this.banWarningCount < 0) {
                this.banWarningCount = 0;
            }

            if (this.timesAccountHasBeenBanned < 0) {
                this.timesAccountHasBeenBanned = 0;
            }

            const suspensionExpired =
                !this.accountBanned &&
                this.bannedUntil instanceof Date &&
                this.bannedUntil.getTime() <= Date.now() &&
                this.accountStatus === "suspended";

            if (suspensionExpired) {
                this.bannedUntil = null;
                this.accountStatus = "active";
            }

        });

        /**
         * Increase failed login attempts and lock if threshold is reached
         */
        schema.methods.incrementLoginAttempts = async function () {
            const attempts = (this.loginAttempts || 0) + 1;
            const now = Date.now();

            const currentlyLocked =
                this.lockUntil instanceof Date &&
                this.lockUntil.getTime() > now;

            const shouldLock =
                attempts >= MAX_FAILED_ATTEMPTS && !currentlyLocked;

            const newLockUntil = shouldLock
                ? new Date(now + LOCK_DURATION)
                : this.lockUntil;

            this.loginAttempts = attempts;
            this.lockUntil = newLockUntil;

            return this;
        };

        /**
         * Reset login attempts after successful login
         */
        schema.methods.handleSuccessfulLoginAttempt = async function () {
            const now = new Date();
            this.loginAttempts = 0;
            this.lockUntil = null;
            this.lastLoginAt = now;

            return this;
        };

        /**
         * Unlock account manually
         */
        schema.methods.unlockAccount = async function () {
            this.loginAttempts = 0;
            this.lockUntil = null;

            return this;
        };

        /**
         * Permanently ban or temporarily suspend account
         * durationMs = null -> permanent ban
         * durationMs = number -> temporary suspension until future date
         */
        schema.methods.banAccount = async function (durationMs = null) {
            const isTemporary = Number.isFinite(durationMs) && durationMs > 0;

            this.accountBanned = !isTemporary;
            this.accountStatus = isTemporary ? "suspended" : "banned";
            this.bannedUntil = isTemporary ? new Date(Date.now() + durationMs) : null;
            this.timesAccountHasBeenBanned =
                (this.timesAccountHasBeenBanned || 0) + 1;

            return this;
        };

        /**
         * Remove ban/suspension and reactivate account
         */
        schema.methods.unbanAccount = async function () {
            this.accountBanned = false;
            this.bannedUntil = null;
            this.accountStatus = "active";

            return this;
        };
    }
);

export { UserSecurity };
export default UserSecurity;
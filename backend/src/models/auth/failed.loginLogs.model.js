import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";

const FAILED_LOGIN_REASONS = [
    "invalid_credentials",
    "locked_account",
    "banned_account",
    "inactive_account",
    "provider_mismatch",
    "unknown_identifier",
    "invalid_password",
];

const FailedLoginLogsSchema = new mongoose.Schema ({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },

    ipAddress: {
        type: String,
        required: [true, "IP address is required"],
        trim: true,
        maxlength: [100, "IP address is too long"],
        index: true,
    },

    userAgent: {
        type: String,
        default: null,
        trim: true,
        maxlength: [500, "User agent is too long"],
    },

    deviceName: {
        type: String,
        default: null,
        trim: true,
        maxlength: [255, "Device name is too long"],
    },

    attemptedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },

    reason: {
        type: String,
        enum: FAILED_LOGIN_REASONS,
        default: "invalid_credentials",
        trim: true,
    },
});


FailedLoginLogsSchema.index(
            { attemptedAt: 1 },
            { expireAfterSeconds: 60 * 60 * 24 * 90 }
     );

        /**
         * Useful for rate-limit / brute-force checks by IP
         */
      
FailedLoginLogsSchema.index({ ipAddress: 1, attemptedAt: -1 });

        /**
         * Useful for user-specific failed login history
         */

FailedLoginLogsSchema.index({ userId: 1, attemptedAt: -1 });

        schema.pre("validate", function () {
            if (typeof this.userAgent === "string" && !this.userAgent.trim()) {
                this.userAgent = null;
            }

            if (typeof this.deviceName === "string" && !this.deviceName.trim()) {
                this.deviceName = null;
            }
        });
const FailedLoginLogs = mongoose.model("FailedLoginLogs", FailedLoginLogsSchema);
        


export { FailedLoginLogs };
export default FailedLoginLogs;
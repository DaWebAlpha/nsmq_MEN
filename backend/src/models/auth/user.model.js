import mongoose from "mongoose";
import validator from "validator";
import { hashPassword, verifyPassword } from "../../utils/password.argon2.js";
import { AppError } from "../../errors/app.error.js";
import { RESERVED_WORDS, normalizeValue } from "../../string.utils.js";
import { createBaseModel } from "../mongoose.model.base.js";
import { system_logger } from "../../core/pino.logger.js";

const USERNAME_REGEX = /^(?=.{3,20}$)[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;
const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,120}$/;

const AUTH_PROVIDERS = ["local", "google"];
const USER_ROLES = ["user", "moderator", "admin", "superadmin"];

const userSchemaDefinition = {
    username: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        minlength: [3, "Username is too short"],
        maxlength: [20, "Username is too long"],
        match: [USERNAME_REGEX, "Invalid username format"],
        validate: {
            validator: function (val) {
                /**
                 * Username is required for local accounts
                 * Username is optional for google accounts
                 */
                if (!val) {
                    return this.authProvider === "google";
                }

                const normalized = normalizeValue(String(val || ""));
                return !RESERVED_WORDS.has(normalized);
            },
            message: "Invalid or reserved username",
        },
    },

    email: {
        type: String,
        required: [true, "Email is required"],
        trim: true,
        lowercase: true,
        validate: {
            validator: function (val) {
                return validator.isEmail(normalizeValue(String(val || "")));
            },
            message: "Invalid email format",
        },
    },

    password: {
        type: String,
        default: null,
        select: false,
        validate: {
            validator: function (val) {
                /**
                 * Google accounts do not require password
                 */
                if (this.authProvider === "google") {
                    return !val || PASSWORD_REGEX.test(String(val || ""));
                }

                /**
                 * Local accounts must have password
                 */
                if (this.authProvider === "local") {
                    if (!val) return false;

                    if (!this.isNew && !this.isModified("password")) {
                        return true;
                    }

                    return PASSWORD_REGEX.test(String(val || ""));
                }

                return false;
            },
            message:
                "Password is required for local accounts and must meet complexity requirements",
        },
    },

    authProvider: {
        type: String,
        enum: AUTH_PROVIDERS,
        default: "local",
        index: true,
    },

    googleSub: {
        type: String,
        trim: true,
        default: null,
        validate: {
            validator: function (val) {
                /**
                 * Google accounts must have googleSub
                 * Local accounts do not need it
                 */
                if (this.authProvider !== "google") return true;
                return Boolean(String(val || "").trim());
            },
            message: "googleSub is required for Google accounts",
        },
    },

    role: {
        type: String,
        enum: USER_ROLES,
        default: "user",
        index: true,
    },

    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },

    isPremium: {
        type: Boolean,
        default: false,
        index: true,
    },

    lastPasswordChangedAt: {
        type: Date,
        default: null,
        index: true,
    },

    passwordResetToken: {
        type: String,
        trim: true,
        default: null,
        select: false,
    },

    passwordResetExpiresAt: {
        type: Date,
        default: null,
        select: false,
        index: true,
    },
};

const User = createBaseModel("User", userSchemaDefinition, (schema) => {
    /**
     * Unique email for all active/non-deleted users
     */
    schema.index(
        { email: 1 },
        {
            unique: true,
            partialFilterExpression: {
                isDeleted: false,
            },
        }
    );

    /**
     * Username is unique, but only for documents that actually have a username
     */
    schema.index(
        { username: 1 },
        {
            unique: true,
            sparse: true,
            partialFilterExpression: {
                isDeleted: false,
                username: { $type: "string" },
            },
        }
    );

    /**
     * googleSub must be unique for Google-authenticated users
     */
    schema.index(
        { googleSub: 1 },
        {
            unique: true,
            sparse: true,
            partialFilterExpression: {
                isDeleted: false,
                googleSub: { $type: "string" },
            },
        }
    );

    schema.index({ createdAt: -1 });
    schema.index({ isDeleted: 1, deletedAt: 1 });

    schema.pre("validate", function () {
        if (typeof this.username === "string" && this.username.trim()) {
            this.username = normalizeValue(this.username);
        } else {
            this.username = null;
        }

        if (typeof this.email === "string") {
            this.email = normalizeValue(this.email);
        }

        if (typeof this.googleSub === "string" && this.googleSub.trim()) {
            this.googleSub = this.googleSub.trim();
        } else {
            this.googleSub = null;
        }
    });


    schema.pre("save", async function (){
            if (this.isModified("password") && this.password) {
                this.password = await hashPassword(this.password);
                this.lastPasswordChangedAt = new Date();
            }
    });


    /**
     * Compare plain password with stored password hash
     */
    schema.methods.comparePassword = async function (plainPassword) {
        if (!this.password) {
            system_logger.error("Password field not selected in query.");
            throw new AppError("Internal authentication error", 500);
        }
        return verifyPassword(String(plainPassword || ""), this.password);
    };


    /**
     * Find local-login candidate by username or email
     * Includes hidden password
     */
    schema.statics.findByUsernameOrEmail = function (identifier){
        const normalized = normalizeValue(String(identifier || ""));

        if (!normalized) {
            system_logger.warn("Attempt to find user with empty identifier");
            throw new AppError("Email or username is required", 400);
        }

        return this.findOne({
            isDeleted: false,
            $or: [{ username: normalized }, { email: normalized }],
        }).select("+password");
    };



    /**
     * Find a Google account by googleSub
     */
    schema.statics.findByGoogleSub = async function (googleSub) {
        const sub = String(googleSub || "").trim();

        if (!sub) {
            throw new AppError("Google subject is required", 400);
        }

        return this.findOne({
            isDeleted: false,
            googleSub: sub,
        });
    };

});

export { User };
export default User;
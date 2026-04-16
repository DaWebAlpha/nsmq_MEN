import crypto from 'crypto';
import mongoose from 'mongoose';
import { createBaseModel } from "../mongoose.model.base.js";

const refreshTokenDefinition = {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  tokenHash: {
    type: String,
    required: true,
    trim: true,
  },

  tokenVersion: {
    type: Number,
    default: 0,
    min: 0,
  },

  deviceId: {
    type: String,
    trim: true,
    required: true,
  },

  deviceName: {
    type: String,
    trim: true,
    default: null,
    maxlength: 150,
  },

  userAgent: {
    type: String,
    trim: true,
    default: null,
    maxlength: 500,
  },

  ipAddress: {
    type: String,
    trim: true,
    default: null,
    maxlength: 100,
  },

  expiresAt: {
    type: Date,
    required: true,
  },

  lastUsedAt: {
    type: Date,
    default: Date.now,
  },

  revokedAt: {
    type: Date,
    default: null,
  },

  revokeReason: {
    type: String,
    trim: true,
    maxlength: 200,
    default: null,
  },

  isRevoked: {
    type: Boolean,
    default: false,
  },
};

const RefreshToken = createBaseModel(
  'RefreshToken',
  refreshTokenDefinition,
  (schema) => {
    /**
     * UNIQUE TOKEN HASH
     */
    schema.index(
      { tokenHash: 1 },
      {
        unique: true,
        partialFilterExpression: { isDeleted: false },
      }
    );

    /**
     * FAST LOOKUP FOR ACTIVE TOKENS
     */
    schema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

    /**
     * ONE ACTIVE TOKEN PER USER + DEVICE
     */
    schema.index(
      { userId: 1, deviceId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          isRevoked: false,
          isDeleted: false,
        },
      }
    );

    /**
     * TTL INDEX
     */
    schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    /**
     * HASH TOKEN
     */
    schema.statics.hashToken = function (rawToken) {
      return crypto
        .createHash('sha256')
        .update(String(rawToken))
        .digest('hex');
    };

    /**
     * FIND ACTIVE TOKEN BY RAW TOKEN
     */
    schema.statics.findActiveByRawToken = function (rawToken) {
      const tokenHash = this.hashToken(rawToken);

      return this.findOne({
        tokenHash,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
        isDeleted: false,
      });
    };

    /**
     * FIND ACTIVE TOKEN BY USER + DEVICE - UNUSED FOR NOW
     */
    schema.statics.findActiveByUserAndDevice = function (userId, deviceId) {
      return this.findOne({
        userId,
        deviceId: String(deviceId || '').trim(),
        isRevoked: false,
        expiresAt: { $gt: new Date() },
        isDeleted: false,
      });
    };

    /**
     * NORMALIZE EMPTY STRINGS
     */
    schema.pre('validate', function (next) {
      const nullableFields = [
        'deviceName',
        'userAgent',
        'ipAddress',
        'revokeReason',
      ];

      for (const field of nullableFields) {
        if (typeof this[field] === 'string') {
          this[field] = this[field].trim();
          if (this[field] === '') {
            this[field] = null;
          }
        }
      }

      if (typeof this.deviceId === 'string') {
        this.deviceId = this.deviceId.trim();
      }

      next();
    });

    /**
     * VALIDATE EXPIRY
     */
    schema.pre('validate', function (next) {
      if (this.expiresAt && this.expiresAt.getTime() <= Date.now()) {
        return next(new Error('expiresAt must be a future date'));
      }

      next();
    });

    /**
     * REVOKE TOKEN
     */
    schema.methods.revoke = async function (reason = 'manual_revocation') {
      if (this.isRevoked) return this;

      const normalizedReason =
        typeof reason === 'string' && reason.trim()
          ? reason.trim()
          : 'manual_revocation';

      this.isRevoked = true;
      this.revokedAt = new Date();
      this.revokeReason = normalizedReason;
      this.tokenVersion = (this.tokenVersion || 0) + 1;

      return this.save({ validateBeforeSave: false });
    };

    /**
     * ROTATE TOKEN - UNUSED FOR NOW
     */
    schema.methods.rotate = async function ({
      newTokenHash,
      expiresAt,
      tokenVersion,
    }) {
      const normalizedTokenHash = String(newTokenHash || '').trim();

      if (!normalizedTokenHash) {
        throw new Error('newTokenHash is required');
      }

      if (!/^[a-f0-9]{64}$/i.test(normalizedTokenHash)) {
        throw new Error('newTokenHash must be a valid sha256 hex string');
      }

      if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
        throw new Error('expiresAt must be a valid Date');
      }

      if (expiresAt.getTime() <= Date.now()) {
        throw new Error('expiresAt must be in the future');
      }

      this.tokenHash = normalizedTokenHash;
      this.expiresAt = expiresAt;
      this.tokenVersion =
        typeof tokenVersion === 'number' && tokenVersion >= 0
          ? tokenVersion
          : (this.tokenVersion || 0) + 1;

      this.lastUsedAt = new Date();
      this.isRevoked = false;
      this.revokedAt = null;
      this.revokeReason = null;

      return this.save({ validateBeforeSave: false });
    };

    /**
     * CHECK IF ACTIVE - UNUSED FOR NOW
     */
    schema.methods.isActive = function () {
      return (
        !this.isRevoked &&
        this.expiresAt instanceof Date &&
        this.expiresAt.getTime() > Date.now()
      );
    };
  }
);

export { RefreshToken };
export default RefreshToken;
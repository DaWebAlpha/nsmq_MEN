import { User } from "../models/user.model.js";
import { AppError } from "../errors/app.error.js";
import { normalizeValue } from "../utils/string.utils.js";
import { BaseRepository } from "./base.repository.js";
import { system_logger } from "../core/pino.logger.js";

class UserRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    /**
     * Check whether a username already exists
     */
    async checkIfUsernameExists(username, options = {}) {
        const user = await this.exists(
            {
                username: normalizeValue(String(username || "")),
            },
            options
        );

        return !!user;
    }

    /**
     * Check whether an email already exists
     */
    async checkIfEmailExists(email, options = {}) {
        const user = await this.exists(
            {
                email: normalizeValue(String(email || "")),
            },
            options
        );

        return !!user;
    }

    /**
     * Find a user by username or email
     */
    async findByUsernameOrEmail(identifier, options = {}) {
        const normalizedIdentifier = normalizeValue(String(identifier || ""));
        const query = this.model.findByUsernameOrEmail(normalizedIdentifier);

        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);
        if (options.session) query.session(options.session);
        if (options.lean) query.lean();

        const doc = await query;

        if (!doc) {
            system_logger.error(`User not found with identifier: ${identifier}`);
            throw new AppError("Invalid credentials", 401);
        }

        return options.lean === true
            ? this._transformLean(doc)
            : this._normalizeDoc(doc);
    }

    
    async findByGoogleSub(googleSub, options = {}) {
        const sanitizedGoogleSub = String(googleSub ?? "").trim();
        const query = this.model.findByGoogleSub(sanitizedGoogleSub);

        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);
        if (options.session) query.session(options.session);
        if (options.lean) query.lean();

        const doc = await query;

        if (!doc) {
            system_logger.error("User not found with googleSub");
            throw new AppError("Invalid credentials", 401);
        }

        return options.lean === true
            ? this._transformLean(doc)
            : this._normalizeDoc(doc);
    }
}

const userRepository = new UserRepository();

export { UserRepository, userRepository };
export default userRepository;
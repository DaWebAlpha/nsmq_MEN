import { config } from "../config/config.js";


/** 
 * Check environment to avoid performance-heavy indexing in production 
 */
const NODE_ENV = config.node_env;

/**
 * Security Transform Function
 * Sanitizes data before it's sent to the client or converted to a plain object.
 * 
 * @param {Object} _doc - The original Mongoose document
 * @param {Object} ret - The plain object representation to be modified
 */
const securityTransform = (_doc, ret) => {
    // 1. Remove sensitive credentials
    if (ret?.password) delete ret.password;
    
    // 2. Ensure a string 'id' exists for frontend/API consumption
    if (ret?._id) {
        ret.id = ret._id.toString();
    }

    // 3. Cleanup internal Mongoose versioning and custom security tokens
    delete ret.__version;    // Custom versioning (if used)
    delete ret.__v;          // Mongoose default version key
    delete ret.__token;      // Internal session/auth tokens
    delete ret.__hashToken;  // Internal security hashes
    
    return ret;
}

/**
 * Base Schema Options
 * Default configuration for all Mongoose schemas to ensure consistency.
 */
const baseOptions = {
    strict: true,        // Ensure only fields defined in schema are saved
    strictQuery: true,   // Ensure only fields defined in schema are used in queries
    timestamps: true,    // Automatically add createdAt and updatedAt fields
    
    // Disable auto-indexing in production to prevent performance bottlenecks
    autoIndex: NODE_ENV === "development",

    // Configuration for JSON.stringify() (API responses)
    toJSON: {
        virtuals: true,  // Include virtual properties
        getters: true,   // Run defined getter functions
        transform: securityTransform,
    },

    // Configuration for .toObject() (Internal logic)
    toObject: {
        virtuals: true,
        getters: true,
        transform: securityTransform,
    },

    // Ensures Mongoose creates the virtual 'id' getter by default
    id: true,
}

export { baseOptions };
export default baseOptions;

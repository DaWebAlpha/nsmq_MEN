import { baseOptions } from "./base.options.js";
import mongoose from 'mongoose';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Setup DOMPurify for XSS protection
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Common fields for auditing and soft-deletion
 */
const baseFields = {
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true},
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}

const createBaseModel = (name, schemaDefinition, configCallback) => {
    const schema = new mongoose.Schema({
        ...schemaDefinition,
        ...baseFields,
    }, baseOptions);

    /**
     * Middleware: Sanitize all string fields before validation
     * Prevents XSS by cleaning HTML and normalizing unicode
     */
    schema.pre('validate', function() {
        // Iterate through all modified paths in the document
        this.modifiedPaths().forEach(path => {
            const value = this.get(path);
            if (typeof value === "string") {
                const cleanValue = DOMPurify.sanitize(value.normalize('NFC')).trim();
                this.set(path, cleanValue);
            }
        });
    });

    /**
     * Middleware: Global Soft-Delete Filter
     * Automatically excludes deleted documents from find/findOne/etc.
     */
    schema.pre(/^find/, function() {
        // Only filter if the user hasn't explicitly asked for deleted items
        if (!Object.prototype.hasOwnProperty.call(this.getQuery(), 'isDeleted')) {
            this.where({ isDeleted: false });
        }
    });

    /**
     * Instance Method: Soft Delete
     */
    schema.methods.softDelete = async function(userId = null) {
        this.isDeleted = true;
        this.deletedAt = new Date();
        this.deletedBy = userId;
        return this.save({ validateBeforeSave: false });
    };

    /**
     * Instance Method: Restore a deleted document
     */
    schema.methods.restoreDelete = async function() {
        this.isDeleted = false;
        this.deletedAt = null;
        this.deletedBy = null;
        return this.save({ validateBeforeSave: false });
    };

    /**
     * Instance Method: Hard Delete (Permanent)
     */
    schema.methods.hardDelete = async function() {
        return this.deleteOne();
    };

    // Allow additional custom configuration via callback
    if (configCallback && typeof configCallback === "function") {
        configCallback(schema);
    }

    // Return existing model if compiled, otherwise create new
    return mongoose.models[name] || mongoose.model(name, schema);
}

export { createBaseModel };
export default createBaseModel;
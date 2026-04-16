import { AppError } from "../errors/app.error.js";

class BaseRepository {
    constructor(model) {
        this.model = model;
        this.modelName = model.modelName;
    }

    /**
     * Private helper to manually apply security transformations
     * to lean objects (since they bypass Mongoose middleware/transforms).
     */
    _transformLean(doc) {
        if (!doc) return doc;

        // Handle arrays (for findAll)
        if (Array.isArray(doc)) {
            return doc.map((item) => this._transformLean(item));
        }

        // Handle single object
        const cleanDoc = { ...doc };

        if (cleanDoc._id && !cleanDoc.id) {
            cleanDoc.id = String(cleanDoc._id);
            //delete cleanDoc._id;
        }

        delete cleanDoc.__v;
        delete cleanDoc.__version;

        return cleanDoc;
    }

    /**
     * Normalize both mongoose documents and lean/plain objects
     * so returned data stays consistent.
     */
    _normalizeDoc(doc) {
        if (!doc) return doc;

        if (Array.isArray(doc)) {
            return doc.map((item) => this._normalizeDoc(item));
        }

        if (typeof doc?.toObject === "function") {
            return doc.toObject();
        }

        return this._transformLean(doc);
    }

    /* CREATE */
    async create(payload, options = {}) {
        const [doc] = await this.model.create([payload], options);
        return this._normalizeDoc(doc);
    }

    async insertMany(data, options = {}) {
        const docs = await this.model.insertMany(data, options);
        return this._normalizeDoc(docs);
    }

    async findById(id, options = {}) {
        const isLean = options.lean !== false;
        const query = this.model.findById(id);

        if (options.session) query.session(options.session);
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);
        if (isLean) query.lean();

        const doc = await query;

        if (!doc) {
            throw new AppError(`${this.modelName} with id ${id} not found`, 404);
        }

        return isLean ? this._transformLean(doc) : this._normalizeDoc(doc);
    }

    async findOne(filter, options = {}) {
        const isLean = options.lean !== false;
        const query = this.model.findOne(filter);

        if (options.session) query.session(options.session);
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);
        if (isLean) query.lean();

        const doc = await query;
        if (!doc) throw new AppError(`${this.modelName} not found`, 404);

        return isLean ? this._transformLean(doc) : this._normalizeDoc(doc);
    }

    async findAll(filter = {}, options = {}) {
        const rawPage = Number(options.page ?? 1);
        const rawLimit = Number(options.limit ?? 20);

        const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;

        const {
            sort = { createdAt: -1 },
            select = "",
            populate = "",
            lean = true,
            session,
        } = options;

        const cappedLimit = Math.min(limit, 100);
        const skip = (page - 1) * cappedLimit;

        const findQuery = this.model
            .find(filter)
            .sort(sort)
            .select(select)
            .populate(populate)
            .skip(skip)
            .limit(cappedLimit)
            .lean(lean);

        const countQuery = this.model.countDocuments(filter);

        if (session) {
            findQuery.session(session);
            countQuery.session(session);
        }

        const [docs, total] = await Promise.all([findQuery, countQuery]);

        return {
            docs: lean ? this._transformLean(docs) : this._normalizeDoc(docs),
            total,
            page,
            limit: cappedLimit,
            totalPages: Math.ceil(total / cappedLimit),
        };
    }

    async updateById(id, data, options = {}) {
        const doc = await this.model.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true, ...options }
        );

        if (!doc) {
            throw new AppError(`${this.modelName} with id ${id} not found`, 404);
        }

        return this._normalizeDoc(doc);
    }

    async deleteById(id, options = {}) {
        const doc = await this.model.findByIdAndDelete(id, options);

        if (!doc) {
            throw new AppError(`${this.modelName} with id ${id} not found`, 404);
        }

        return this._normalizeDoc(doc);
    }

    async deleteAll(filter = {}, options = {}) {
        return this.model.deleteMany(filter, options);
    }

    async exists(filter = {}, options = {}) {
        const query = this.model.exists(filter);

        if (options.session) query.session(options.session);

        return query;
    }

    async count(filter = {}, options = {}) {
        const query = this.model.countDocuments(filter);

        if (options.session) query.session(options.session);

        return query;
    }

    async hardDelete(id, options = {}) {
        const query = this.model.findOne({ _id: id }).setOptions({ skipFilter: true });

        if (options.session) query.session(options.session);
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);

        const doc = await query;
        if (!doc) throw new AppError(`${this.modelName} with id ${id} not found`, 404);

        return await doc.hardDelete(options);
    }

    async softDeleteById(id, options = {}) {
        const query = this.model.findOne({ _id: id }).setOptions({ skipFilter: true });

        if (options.session) query.session(options.session);
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);

        const doc = await query;
        if (!doc) throw new AppError(`${this.modelName} with id ${id} not found`, 404);

        const softDeletedDoc = await doc.softDelete(options);
        return this._normalizeDoc(softDeletedDoc);
    }

    async restoreSoftDeleteById(id, options = {}) {
        const query = this.model.findOne({ _id: id, isDeleted: true });

        if (options.session) query.session(options.session);

        const doc = await query;

        if (!doc) {
            throw new AppError(`${this.modelName} with id ${id} not found`, 404);
        }

        const restoredDoc = await doc.restoreDelete(options);
        return this._normalizeDoc(restoredDoc);
    }

}



export { BaseRepository };
export default {
    BaseRepository
};
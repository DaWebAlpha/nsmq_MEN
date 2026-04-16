import mongoose from "mongoose";

/**
 * Run a group of database operations in a MongoDB transaction.
 * The callback receives the active session.
 */
const withTransaction = async (work) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const result = await work(session);

        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

export { withTransaction };
export default withTransaction;
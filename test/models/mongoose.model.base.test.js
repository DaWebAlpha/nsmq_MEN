import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockSanitize = jest.fn();
const mockSchemaPre = jest.fn();

class MockSchema {
  constructor(definition, options) {
    this.definition = definition;
    this.options = options;
    this.methods = {};
    this.pre = mockSchemaPre;
  }
}

MockSchema.Types = {
  ObjectId: "ObjectId",
};

const mockModel = jest.fn();
const mockModels = {};
const mockBaseOptions = { strict: true, timestamps: true };

jest.unstable_mockModule("../../backend/src/models/base.options.js", () => ({
  baseOptions: mockBaseOptions,
}));

jest.unstable_mockModule("mongoose", () => ({
  default: {
    Schema: MockSchema,
    model: mockModel,
    models: mockModels,
  },
}));

jest.unstable_mockModule("dompurify", () => ({
  default: jest.fn(() => ({
    sanitize: mockSanitize,
  })),
}));

jest.unstable_mockModule("jsdom", () => ({
  JSDOM: jest.fn(() => ({
    window: {},
  })),
}));

const { createBaseModel } = await import(
  "../../backend/src/models/mongoose.model.base.js"
);
const mongoose = (await import("mongoose")).default;

describe("createBaseModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSanitize.mockImplementation((value) => value);
    mockModel.mockReturnValue({ modelName: "MockModel" });

    for (const key of Object.keys(mockModels)) {
      delete mockModels[key];
    }
  });

  it("should create schema with merged schemaDefinition and base fields", () => {
    createBaseModel("Post", {
      title: { type: String, required: true },
    });

    const schemaInstance = mockModel.mock.calls[0][1];

    expect(schemaInstance.definition.title).toEqual({
      type: String,
      required: true,
    });

    expect(schemaInstance.definition.deletedBy).toEqual({
      type: "ObjectId",
      ref: "User",
      default: null,
      index: true,
    });

    expect(schemaInstance.definition.isDeleted).toEqual({
      type: Boolean,
      default: false,
      index: true,
    });

    expect(schemaInstance.definition.deletedAt).toEqual({
      type: Date,
      default: null,
    });

    expect(schemaInstance.definition.updatedBy).toEqual({
      type: "ObjectId",
      ref: "User",
      index: true,
    });

    expect(schemaInstance.options).toBe(mockBaseOptions);
  });

  it("should register validate middleware", () => {
    createBaseModel("Post", { title: String });

    expect(mockSchemaPre).toHaveBeenCalledWith(
      "validate",
      expect.any(Function)
    );
  });

  it("should sanitize and trim modified string fields in validate middleware", () => {
    createBaseModel("Post", { title: String, body: String });

    const validateCall = mockSchemaPre.mock.calls.find(
      ([hook]) => hook === "validate"
    );
    const validateMiddleware = validateCall[1];

    mockSanitize.mockImplementation((value) => `clean:${value}`);

    const doc = {
      modifiedPaths: jest.fn(() => ["title", "count", "body"]),
      get: jest.fn((path) => {
        const values = {
          title: "  <b>Hello</b>  ",
          count: 25,
          body: " Café ",
        };
        return values[path];
      }),
      set: jest.fn(),
    };

    validateMiddleware.call(doc);

    expect(mockSanitize).toHaveBeenCalledTimes(2);
    expect(mockSanitize).toHaveBeenNthCalledWith(1, "<b>Hello</b>");
    expect(mockSanitize).toHaveBeenNthCalledWith(2, "Café");

    expect(doc.set).toHaveBeenCalledTimes(2);
    expect(doc.set).toHaveBeenNthCalledWith(1, "title", "clean:<b>Hello</b>");
    expect(doc.set).toHaveBeenNthCalledWith(2, "body", "clean:Café");
  });

  it("should not sanitize non-string fields in validate middleware", () => {
    createBaseModel("Post", { count: Number });

    const validateCall = mockSchemaPre.mock.calls.find(
      ([hook]) => hook === "validate"
    );
    const validateMiddleware = validateCall[1];

    const doc = {
      modifiedPaths: jest.fn(() => ["count", "flag"]),
      get: jest.fn((path) => {
        const values = {
          count: 99,
          flag: true,
        };
        return values[path];
      }),
      set: jest.fn(),
    };

    validateMiddleware.call(doc);

    expect(mockSanitize).not.toHaveBeenCalled();
    expect(doc.set).not.toHaveBeenCalled();
  });

  it("should register find middleware", () => {
    createBaseModel("Post", { title: String });

    expect(mockSchemaPre).toHaveBeenCalledWith(
      /^find/,
      expect.any(Function)
    );
  });

  it("should filter out deleted documents when isDeleted is not specified", () => {
    createBaseModel("Post", { title: String });

    const findCall = mockSchemaPre.mock.calls.find(
      ([hook]) => hook instanceof RegExp && hook.toString() === /^find/.toString()
    );
    const findMiddleware = findCall[1];

    const query = {
      getQuery: jest.fn(() => ({ title: "hello" })),
      where: jest.fn(),
    };

    findMiddleware.call(query);

    expect(query.where).toHaveBeenCalledWith({ isDeleted: false });
  });

  it("should not override query when isDeleted is explicitly provided", () => {
    createBaseModel("Post", { title: String });

    const findCall = mockSchemaPre.mock.calls.find(
      ([hook]) => hook instanceof RegExp && hook.toString() === /^find/.toString()
    );
    const findMiddleware = findCall[1];

    const query = {
      getQuery: jest.fn(() => ({ isDeleted: true })),
      where: jest.fn(),
    };

    findMiddleware.call(query);

    expect(query.where).not.toHaveBeenCalled();
  });

  it("should soft delete a document", async () => {
    createBaseModel("Post", { title: String });

    const schemaInstance = mockModel.mock.calls[0][1];
    const doc = {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      save: jest.fn().mockResolvedValue("saved"),
    };

    const result = await schemaInstance.methods.softDelete.call(doc, "user123");

    expect(doc.isDeleted).toBe(true);
    expect(doc.deletedAt).toBeInstanceOf(Date);
    expect(doc.deletedBy).toBe("user123");
    expect(doc.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    expect(result).toBe("saved");
  });

  it("should soft delete with null userId by default", async () => {
    createBaseModel("Post", { title: String });

    const schemaInstance = mockModel.mock.calls[0][1];
    const doc = {
      isDeleted: false,
      deletedAt: null,
      deletedBy: "old-user",
      save: jest.fn().mockResolvedValue("saved"),
    };

    await schemaInstance.methods.softDelete.call(doc);

    expect(doc.isDeleted).toBe(true);
    expect(doc.deletedAt).toBeInstanceOf(Date);
    expect(doc.deletedBy).toBeNull();
    expect(doc.save).toHaveBeenCalledWith({ validateBeforeSave: false });
  });

  it("should restore a deleted document", async () => {
    createBaseModel("Post", { title: String });

    const schemaInstance = mockModel.mock.calls[0][1];
    const doc = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: "user123",
      save: jest.fn().mockResolvedValue("restored"),
    };

    const result = await schemaInstance.methods.restoreDelete.call(doc);

    expect(doc.isDeleted).toBe(false);
    expect(doc.deletedAt).toBeNull();
    expect(doc.deletedBy).toBeNull();
    expect(doc.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    expect(result).toBe("restored");
  });

  it("should hard delete a document", async () => {
    createBaseModel("Post", { title: String });

    const schemaInstance = mockModel.mock.calls[0][1];
    const doc = {
      deleteOne: jest.fn().mockResolvedValue("deleted"),
    };

    const result = await schemaInstance.methods.hardDelete.call(doc);

    expect(doc.deleteOne).toHaveBeenCalledTimes(1);
    expect(result).toBe("deleted");
  });

  it("should call configCallback when provided", () => {
    const configCallback = jest.fn();

    createBaseModel("Post", { title: String }, configCallback);

    const schemaInstance = mockModel.mock.calls[0][1];

    expect(configCallback).toHaveBeenCalledTimes(1);
    expect(configCallback).toHaveBeenCalledWith(schemaInstance);
  });

  it("should return existing compiled model if already present", () => {
    const existingModel = { modelName: "ExistingModel" };
    mockModels.Post = existingModel;

    const result = createBaseModel("Post", { title: String });

    expect(result).toBe(existingModel);
    expect(mongoose.model).not.toHaveBeenCalled();
  });

  it("should create and return new model if one does not exist", () => {
    const createdModel = { modelName: "CreatedModel" };
    mockModel.mockReturnValue(createdModel);

    const result = createBaseModel("Post", { title: String });

    expect(mongoose.model).toHaveBeenCalledTimes(1);
    expect(mongoose.model).toHaveBeenCalledWith(
      "Post",
      expect.any(MockSchema)
    );
    expect(result).toBe(createdModel);
  });
});
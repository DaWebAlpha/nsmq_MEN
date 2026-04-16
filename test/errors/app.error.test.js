import { describe, it, expect } from "@jest/globals";


const { AppError } = await import("../../backend/src/errors/app.error.js");

describe("AppError", () => {
  it("should create an instance of AppError", () => {
    const error = new AppError("Something went wrong", 400, {
      field: "email",
    });

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it("should set the correct message", () => {
    const error = new AppError("Invalid credentials", 401);

    expect(error.message).toBe("Invalid credentials");
  });


  it("should set the statusCode", () => {
    const error = new AppError("Something went wrong", 400, {
      field: "email",
    });
    expect(error.statusCode).toBe(400);

  })


  it("should set the correct name", () => {
    const error = new AppError("Invalid credentials", 401);

    expect(error.name).toBe("AppError");
  });


  it("should set the correct details", () => {
    const details = {
      field: "password",
      reason: "too short",
    };

    const error = new AppError("Validation failed", 422, details);

    expect(error.details).toEqual(details);
  });

  it("should set isOperational to true", () => {
    const error = new AppError("Server error", 500);

    expect(error.isOperational).toBe(true);
  });

  it("should use default values when no arguments are provided", () => {
    const error = new AppError();

    expect(error.message).toBe("Application Error");
    expect(error.statusCode).toBe(500);
    expect(error.details).toBeNull();
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe("AppError");
  });

  it("should capture a stack trace", () => {
    const error = new AppError("Stack test", 500);

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe("string");
    expect(error.stack).toContain("AppError");
  });

  it("should allow null details explicitly", () => {
    const error = new AppError("No details", 400, null);

    expect(error.details).toBeNull();
  });

  it("should allow object details", () => {
    const error = new AppError("Bad request", 400, {
      code: "INVALID_INPUT",
      field: "username",
    });

    expect(error.details).toEqual({
      code: "INVALID_INPUT",
      field: "username",
    });
  });
});
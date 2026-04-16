import argon2 from "argon2";
import { system_logger } from "../core/pino.logger.js";
import { AppError }  from "../errors/app.error.js";

const ARGON_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 2,
  hashLength: 32,
};

export const hashPassword = async (password) => {
  if(typeof password !== "string") return null;
  const cleanPassword = password?.trim();

  
  if (!cleanPassword || typeof cleanPassword !== "string") {
    throw new AppError ("Invalid password input", 400);
  }
  if (cleanPassword.length < 8) {
    throw new AppError ("Password must be at least 8 characters long", 400);
  }

  try {
    return await argon2.hash(cleanPassword, ARGON_CONFIG);
  } catch (error) {
    system_logger.error({ error: error.message }, "Security: Password hashing failed");
    throw new AppError ("Internal security error", 400);
  }
};



export const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    return await argon2.verify(hashedPassword, plainPassword.trim());
  } catch (error) {
    system_logger.error({ error: error.message }, "Security: Password verification failed");
    return false;
  }
};

export default {
  hashPassword,
  verifyPassword,
};
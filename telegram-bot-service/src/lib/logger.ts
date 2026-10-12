import type { FastifyServerOptions } from "fastify";

import type { Env } from "./env.js";

export function buildLoggerOptions(env: Env): FastifyServerOptions["logger"] {
  if (env.NODE_ENV === "development") {
    return {
      level: env.LOG_LEVEL,
      redact: { paths: ["err", "error", "req.headers.authorization", "req.headers.cookie", "req.headers.x-telegram-bot-api-secret-token"], remove: true },
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard"
        }
      }
    };
  }

  return {
    level: env.LOG_LEVEL,
    redact: { paths: ["err", "error", "req.headers.authorization", "req.headers.cookie", "req.headers.x-telegram-bot-api-secret-token"], remove: true }
  };
}

import type { FastifyServerOptions } from "fastify";

import type { Env } from "./env.js";

export function buildLoggerOptions(env: Env): FastifyServerOptions["logger"] {
  if (env.NODE_ENV === "development") {
    return {
      level: env.LOG_LEVEL,
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
    level: env.LOG_LEVEL
  };
}

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1).optional(),
  HEALTHCHECK_DATABASE: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return value === "true";
      }

      return value;
    }, z.boolean())
    .default(false),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_ROUTER_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_RESPONSE_MODEL: z.string().default("gpt-4.1-mini"),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/),
  TELEGRAM_ALLOWED_USER_IDS: z.string().default(""),
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REFRESH_TOKEN: z.string().min(1).optional(),
  GOOGLE_CALENDAR_TIMEZONE: z.string().default("UTC"),
  SLACK_BOT_TOKEN: z.string().min(1).optional(),
  TAVILY_API_KEY: z.string().min(1).optional()
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}

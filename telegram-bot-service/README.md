# Telegram Bot Service

Self-hosted TypeScript bot service for a single Telegram user. It supports three v1 actions:

1. Google Calendar read/query
2. Slack outbound announcements
3. Web search with sources

## Stack

1. Node.js + TypeScript
2. Fastify
3. PostgreSQL
4. Docker
5. Railway
6. OpenAI API for routing and summaries
7. Telegram Bot API
8. Google Calendar API
9. Slack Web API
10. Tavily search API

## Project Layout

1. `src/server.ts`
2. `src/routes/telegram.ts`
3. `src/orchestrator/router.ts`
4. `src/orchestrator/handlers/calendar.ts`
5. `src/orchestrator/handlers/communications.ts`
6. `src/orchestrator/handlers/web-search.ts`
7. `src/integrations/telegram.ts`
8. `src/integrations/google-calendar.ts`
9. `src/integrations/slack.ts`
10. `src/integrations/web-search.ts`
11. `src/lib/openai.ts`
12. `src/lib/env.ts`
13. `src/lib/logger.ts`
14. `src/db/index.ts`
15. `src/auth/allowlist.ts`

## Local Setup

1. Copy `.env.example` to `.env`.
2. Fill in `TELEGRAM_BOT_TOKEN`.
3. Set either `TELEGRAM_ALLOWED_USER_IDS`, `TELEGRAM_ALLOWED_CHAT_IDS`, or both.
4. Add `DATABASE_URL` for Postgres.
5. Add integration credentials as you enable each branch.
6. Install dependencies with `npm install`.
7. Start the service with `npm run dev`.

The service exposes:

1. `GET /healthz`
2. `POST /webhooks/telegram`

## Credential Setup Order

### 1. Telegram

1. Create a bot with BotFather.
2. Put the token in `TELEGRAM_BOT_TOKEN`.
3. Set `TELEGRAM_ALLOWED_USER_IDS` to your Telegram numeric user ID.
4. Deploy or tunnel the service to a public HTTPS URL.
5. Set the webhook:

```bash
npm run set:telegram-webhook -- https://your-domain.com/webhooks/telegram
```

`TELEGRAM_WEBHOOK_SECRET` is required (32–256 characters using letters, numbers, underscores, or hyphens). The script includes it when registering the webhook; unverified webhook requests are rejected.

### 2. Google Calendar

1. Create a Google Cloud project.
2. Enable the Google Calendar API.
3. Configure OAuth consent.
4. Create OAuth client credentials.
5. Obtain a refresh token for your account with `calendar.readonly` only.
6. Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`.
7. Set `GOOGLE_CALENDAR_TIMEZONE` for display formatting.

Supported v1 calendar actions:

1. `What do I have this week?`
2. `List my calendars`

### 3. Slack

1. Create a Slack app.
2. Add `chat:write` and `channels:read`.
3. Add `groups:read` only if you need private channels.
4. Install the app to your workspace.
5. Store the token in `SLACK_BOT_TOKEN`.

Supported v1 format:

```text
Post to Slack #ops: Deploy completed successfully.
```

### 4. Web Search

1. Create a Tavily account.
2. Store the API key in `TAVILY_API_KEY`.

Supported v1 format:

```text
Search the web for latest OpenAI API pricing changes
```

## Deployment

### Railway

1. Create a new Railway project from this directory.
2. Add Postgres.
3. Configure all required environment variables.
4. Deploy the service.
5. Register the Telegram webhook against the Railway HTTPS domain.
6. Confirm `GET /healthz` returns `200`.

## Notes

1. The bot is single-user by design for v1.
2. Unauthorized Telegram senders are ignored and logged.
3. Calendar access is read-only in v1.
4. Slack is outbound-only in v1.
5. Web search responses always include sources.


## Required security configuration

Generate fresh credentials locally (for example, `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`). Never commit the resulting values. Telegram requires TELEGRAM_WEBHOOK_SECRET and registration of that secret with setWebhook. Services reject missing security configuration. Use HTTPS for any access beyond localhost. Rotate any previously deployed default credentials and rebuild/redeploy after applying these changes.

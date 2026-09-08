import { Pool } from "pg";

export interface AuditLogInput {
  service: string;
  action: string;
  status: string;
  chatId?: string;
  userId?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthStateInput {
  service: string;
  status: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export class Database {
  private readonly pool?: Pool;

  public constructor(databaseUrl?: string) {
    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl });
    }
  }

  public get enabled(): boolean {
    return Boolean(this.pool);
  }

  public async initialize(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS allowed_identities (
        id BIGSERIAL PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('user', 'chat')),
        external_id TEXT NOT NULL UNIQUE,
        label TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        last_intent TEXT,
        last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS session_messages (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        user_id TEXT,
        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        intent TEXT,
        message_text TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        service TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        chat_id TEXT,
        user_id TEXT,
        detail TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS integration_health (
        service TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        message TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async ping(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    await this.pool.query("SELECT 1");
    return true;
  }

  public async seedAllowlist(userIds: string[], chatIds: string[]): Promise<void> {
    if (!this.pool) {
      return;
    }

    for (const userId of userIds) {
      await this.pool.query(
        `INSERT INTO allowed_identities (kind, external_id, label)
         VALUES ('user', $1, 'seeded-from-env')
         ON CONFLICT (external_id) DO NOTHING`,
        [userId]
      );
    }

    for (const chatId of chatIds) {
      await this.pool.query(
        `INSERT INTO allowed_identities (kind, external_id, label)
         VALUES ('chat', $1, 'seeded-from-env')
         ON CONFLICT (external_id) DO NOTHING`,
        [chatId]
      );
    }
  }

  public async isAllowedIdentity(kind: "user" | "chat", externalId: string): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    const result = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM allowed_identities WHERE kind = $1 AND external_id = $2
       ) AS exists`,
      [kind, externalId]
    );

    return result.rows[0]?.exists ?? false;
  }

  public async touchSession(chatId: string, userId?: string, lastIntent?: string): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.query(
      `INSERT INTO chat_sessions (chat_id, user_id, last_intent)
       VALUES ($1, $2, $3)
       ON CONFLICT (chat_id)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         last_intent = COALESCE(EXCLUDED.last_intent, chat_sessions.last_intent),
         last_message_at = NOW(),
         updated_at = NOW()`,
      [chatId, userId ?? null, lastIntent ?? null]
    );
  }

  public async appendSessionMessage(input: {
    chatId: string;
    userId?: string;
    direction: "inbound" | "outbound";
    intent?: string;
    messageText: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.query(
      `INSERT INTO session_messages (chat_id, user_id, direction, intent, message_text, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        input.chatId,
        input.userId ?? null,
        input.direction,
        input.intent ?? null,
        input.messageText,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  public async insertAuditLog(input: AuditLogInput): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.query(
      `INSERT INTO audit_logs (service, action, status, chat_id, user_id, detail, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.service,
        input.action,
        input.status,
        input.chatId ?? null,
        input.userId ?? null,
        input.detail ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  public async setIntegrationHealth(input: HealthStateInput): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.query(
      `INSERT INTO integration_health (service, status, message, metadata, checked_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (service)
       DO UPDATE SET
         status = EXCLUDED.status,
         message = EXCLUDED.message,
         metadata = EXCLUDED.metadata,
         checked_at = NOW()`,
      [input.service, input.status, input.message ?? null, JSON.stringify(input.metadata ?? {})]
    );
  }

  public async close(): Promise<void> {
    await this.pool?.end();
  }
}

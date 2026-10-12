import type { Database } from "../../db/index.js";
import { GoogleCalendarClient } from "../../integrations/google-calendar.js";
import type { Env } from "../../lib/env.js";

export class CalendarHandler {
  public constructor(
    private readonly env: Env,
    private readonly db: Database,
    private readonly calendarClient: GoogleCalendarClient
  ) {}

  public async handle(message: string): Promise<string> {
    if (!this.calendarClient.isConfigured()) {
      await this.db.setIntegrationHealth({
        service: "google_calendar",
        status: "unconfigured",
        message: "Missing Google Calendar credentials"
      });

      return "Google Calendar is not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN with calendar.readonly access.";
    }

    try {
      if (/list( my)? calendars/i.test(message)) {
        const calendars = await this.calendarClient.listCalendars();
        await this.db.setIntegrationHealth({
          service: "google_calendar",
          status: "ok",
          message: `Listed ${calendars.length} calendars`
        });

        if (calendars.length === 0) {
          return "I could not find any Google Calendars for this account.";
        }

        return [
          "Your calendars:",
          ...calendars.map((calendar) => `- ${calendar.summary}${calendar.primary ? " (primary)" : ""}`)
        ].join("\n");
      }

      const events = await this.calendarClient.getEventsForCurrentWeek();
      await this.db.setIntegrationHealth({
        service: "google_calendar",
        status: "ok",
        message: `Fetched ${events.length} events`
      });

      if (events.length === 0) {
        return `You have no events scheduled this week in ${this.env.GOOGLE_CALENDAR_TIMEZONE}.`;
      }

      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: this.env.GOOGLE_CALENDAR_TIMEZONE,
        weekday: "long",
        month: "short",
        day: "numeric"
      });

      const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: this.env.GOOGLE_CALENDAR_TIMEZONE,
        hour: "numeric",
        minute: "2-digit"
      });

      const grouped = new Map<string, string[]>();

      for (const event of events) {
        const date = new Date(event.start);
        const dayLabel = formatter.format(date);
        const line = event.isAllDay
          ? `- All day: ${event.summary}${event.location ? ` @ ${event.location}` : ""}`
          : `- ${timeFormatter.format(date)}: ${event.summary}${event.location ? ` @ ${event.location}` : ""}`;

        const lines = grouped.get(dayLabel) ?? [];
        lines.push(line);
        grouped.set(dayLabel, lines);
      }

      const output: string[] = [`This week in ${this.env.GOOGLE_CALENDAR_TIMEZONE}:`];
      for (const [day, lines] of grouped.entries()) {
        output.push(`${day}`);
        output.push(...lines);
      }

      return output.join("\n");
    } catch (error) {
      await this.db.setIntegrationHealth({
        service: "google_calendar",
        status: "error",
        message: "Integration request failed"
      });

      throw error;
    }
  }
}

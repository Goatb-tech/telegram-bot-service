import { google } from "googleapis";

import type { Env } from "../lib/env.js";

export interface CalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  start: string;
  end?: string;
  isAllDay: boolean;
  location?: string;
}

export class GoogleCalendarClient {
  public constructor(private readonly env: Env) {}

  public isConfigured(): boolean {
    return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET && this.env.GOOGLE_REFRESH_TOKEN);
  }

  public async listCalendars(): Promise<CalendarListItem[]> {
    const calendar = this.createCalendarApi();
    const response = await calendar.calendarList.list();

    return (response.data.items ?? []).map((item) => ({
      id: item.id ?? "unknown",
      summary: item.summary ?? "Untitled calendar",
      primary: item.primary ?? false
    }));
  }

  public async getEventsForCurrentWeek(): Promise<CalendarEventItem[]> {
    const calendar = this.createCalendarApi();
    const { timeMin, timeMax } = getCurrentWeekRange();
    const response = await calendar.events.list({
      calendarId: "primary",
      singleEvents: true,
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: 100
    });

    return (response.data.items ?? []).map((item) => {
      const startDateTime = item.start?.dateTime ?? item.start?.date ?? new Date().toISOString();
      const endDateTime = item.end?.dateTime ?? item.end?.date;

      return {
        id: item.id ?? crypto.randomUUID(),
        summary: item.summary ?? "Untitled event",
        start: startDateTime,
        end: endDateTime ?? undefined,
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
        location: item.location ?? undefined
      };
    });
  }

  private createCalendarApi() {
    if (!this.isConfigured()) {
      throw new Error("Google Calendar integration is not configured");
    }

    const auth = new google.auth.OAuth2(this.env.GOOGLE_CLIENT_ID!, this.env.GOOGLE_CLIENT_SECRET!);
    auth.setCredentials({ refresh_token: this.env.GOOGLE_REFRESH_TOKEN! });

    return google.calendar({ version: "v3", auth });
  }
}

function getCurrentWeekRange(): { timeMin: string; timeMax: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString()
  };
}

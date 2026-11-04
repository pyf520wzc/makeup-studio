export type AnalyticsEventName =
  | 'session_created'
  | 'analysis_started'
  | 'outfit_confirmed'
  | 'outfit_draft_saved'
  | 'restoration_scored'
  | 'privacy_accepted'
  | 'data_cleared'
  | 'client_blocked_empty_library';

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  at: string;
  sessionId?: string;
  meta?: Record<string, string | number | boolean | null>;
}

const KEY = 'makeup-studio-events-v1';
const MAX = 200;

export function trackEvent(
  name: AnalyticsEventName,
  opts?: { sessionId?: string; meta?: AnalyticsEvent['meta'] },
): void {
  try {
    const raw = localStorage.getItem(KEY);
    const list: AnalyticsEvent[] = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
    list.unshift({
      name,
      at: new Date().toISOString(),
      sessionId: opts?.sessionId,
      meta: opts?.meta,
    });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore quota */
  }
}

export function loadEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalyticsEvent[];
  } catch {
    return [];
  }
}

export function clearEvents(): void {
  localStorage.removeItem(KEY);
}

export function exportEventsJson(): string {
  return JSON.stringify(loadEvents(), null, 2);
}

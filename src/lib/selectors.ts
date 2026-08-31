import type { LogEntry } from '../types';
import { isSameDay } from './date';

export function todaysLogs(logs: LogEntry[]): LogEntry[] {
  const now = Date.now();
  return logs.filter((l) => isSameDay(l.loggedAt, now)).sort((a, b) => a.loggedAt - b.loggedAt);
}

export function logsForDay(logs: LogEntry[], dayTs: number): LogEntry[] {
  return logs.filter((l) => isSameDay(l.loggedAt, dayTs));
}

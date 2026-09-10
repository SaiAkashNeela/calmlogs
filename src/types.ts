export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  project: string;
  service: string;
  level: LogLevel;
  event: string;
  message: string;
  timestamp: string;
  request_id?: string;
  trace_id?: string;
  metadata?: any;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Service {
  id: string;
  project_id: string;
  name: string;
  type?: string;
  last_seen_at?: string;
}

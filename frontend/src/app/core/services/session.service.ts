import { Injectable } from '@angular/core';

const SESSION_KEY = 'aak_session_id';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private sessionId: string;

  constructor() {
    this.sessionId = this.loadOrCreateSession();
  }

  /** Get the current session ID */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Generate a new session ID (e.g., on user request) */
  regenerateSession(): string {
    this.sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, this.sessionId);
    return this.sessionId;
  }

  private loadOrCreateSession(): string {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const newId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, newId);
    return newId;
  }
}

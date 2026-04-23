/**
 * Monitorea la expiración del access token y emite eventos cuando:
 *  - Faltan `warnBeforeSec` segundos para vencer → 'warn'
 *  - El token venció (o el refresh falló) → 'expire'
 *
 * Framework-agnostic: vive en application. El componente React se suscribe
 * con `subscribe` y reacciona.
 */

type MonitorEvent = 'warn' | 'expire' | 'clear';
type Listener = (event: MonitorEvent) => void;

export interface SessionMonitorConfig {
  /** Segundos antes del `exp` en los que se dispara el warning (default 120) */
  warnBeforeSec: number;
}

const DEFAULT_CONFIG: SessionMonitorConfig = { warnBeforeSec: 120 };

export class SessionMonitor {
  private warnTimer: ReturnType<typeof setTimeout> | null = null;
  private expireTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private currentExpiresAt: number | null = null;

  constructor(private readonly config: SessionMonitorConfig = DEFAULT_CONFIG) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: MonitorEvent): void {
    for (const l of this.listeners) l(event);
  }

  schedule(expiresAt: number): void {
    this.clearTimers();
    if (!expiresAt || expiresAt <= 0) return;
    this.currentExpiresAt = expiresAt;

    const nowMs = Date.now();
    const expMs = expiresAt * 1000;
    const warnMs = expMs - this.config.warnBeforeSec * 1000;

    if (expMs <= nowMs) {
      this.emit('expire');
      return;
    }

    const msUntilWarn = Math.max(0, warnMs - nowMs);
    const msUntilExp = expMs - nowMs;

    this.warnTimer = setTimeout(() => this.emit('warn'), msUntilWarn);
    this.expireTimer = setTimeout(() => this.emit('expire'), msUntilExp);
  }

  clear(): void {
    this.clearTimers();
    this.currentExpiresAt = null;
    this.emit('clear');
  }

  getExpiresAt(): number | null {
    return this.currentExpiresAt;
  }

  private clearTimers(): void {
    if (this.warnTimer) {
      clearTimeout(this.warnTimer);
      this.warnTimer = null;
    }
    if (this.expireTimer) {
      clearTimeout(this.expireTimer);
      this.expireTimer = null;
    }
  }
}

export const sessionMonitor = new SessionMonitor();

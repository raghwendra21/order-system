export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = (value ?? 'info').toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return 'info';
}

const minLevel = parseLogLevel(process.env.LOG_LEVEL);

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function write(level: LogLevel, message: string, extra?: unknown): void {
  if (!shouldEmit(level)) {
    return;
  }
  const line = `[${level.toUpperCase()}] ${message}`;
  if (extra !== undefined) {
    console.log(line, extra);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, extra?: unknown): void {
    write('debug', message, extra);
  },
  info(message: string, extra?: unknown): void {
    write('info', message, extra);
  },
  warn(message: string, extra?: unknown): void {
    write('warn', message, extra);
  },
  error(message: string, extra?: unknown): void {
    write('error', message, extra);
  }
};

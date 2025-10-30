export function createLogger() {
  const formatTimestamp = () => {
    const now = new Date();
    const pad = (n: any) => String(n).padStart(2, '0');
    return (
      `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    );
  };

  const log = (level: any, ...args: any) => {
    const timestamp = formatTimestamp();
    console.log(`${timestamp} [${level}]`, ...args);
  };

  return {
    log: (...args: any) => log('INFO', ...args),
    error: (...args: any) => log('ERROR', ...args),
    warn: (...args: any) => log('WARN', ...args),
    debug: (...args: any) => log('DEBUG', ...args),
  };
}

export const logger = createLogger();

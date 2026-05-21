const fmt = (level: string, msg: string, extra?: Record<string, unknown>) => {
  const ts = new Date().toISOString();
  const e = extra ? ' ' + JSON.stringify(extra) : '';
  return `${ts} [${level}] ${msg}${e}`;
};

export const log = {
  info: (msg: string, extra?: Record<string, unknown>) =>
    console.log(fmt('info', msg, extra)),
  warn: (msg: string, extra?: Record<string, unknown>) =>
    console.warn(fmt('warn', msg, extra)),
  error: (msg: string, extra?: Record<string, unknown>) =>
    console.error(fmt('error', msg, extra)),
  event: (msg: string, extra?: Record<string, unknown>) =>
    console.log(fmt('event', msg, extra)),
};

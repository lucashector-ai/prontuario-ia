const isProd = process.env.NODE_ENV === 'production'
export const log = {
  info: (...args: any[]) => { if (!isProd) console.log(...args) },
  warn: (...args: any[]) => { if (!isProd) console.warn(...args) },
  error: (...args: any[]) => { if (!isProd) console.error(...args) },
}

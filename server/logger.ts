import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = !!process.env.VITEST;

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')),
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});

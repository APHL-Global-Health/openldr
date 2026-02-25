import pino, { type Logger } from "pino";

// Create logger instance
const loggerConfig = {
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
};

export const logger: Logger = pino(loggerConfig);

// Create child loggers for different modules
export const createLogger = (module: string): Logger => {
  return logger.child({ module });
};

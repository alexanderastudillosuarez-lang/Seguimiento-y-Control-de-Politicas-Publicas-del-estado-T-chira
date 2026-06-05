const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.json()
    ),
    defaultMeta: { service: 'simgp-tachira' },
    transports: [
        new transports.File({ filename: path.join(logsDir, 'error.log'),   level: 'error', maxsize: 10485760, maxFiles: 5 }),
        new transports.File({ filename: path.join(logsDir, 'etl.log'),     level: 'info',  maxsize: 10485760, maxFiles: 10 }),
        new transports.File({ filename: path.join(logsDir, 'combined.log'),                maxsize: 10485760, maxFiles: 10 }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, service, ...meta }) => {
                const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${service}] ${level}: ${message}${extra}`;
            })
        ),
    }));
}

module.exports = logger;

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建logs目录（如果不存在）
const logsDir = join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 创建日志写入流
const logStream = fs.createWriteStream(join(logsDir, 'game.log'), { flags: 'a' });

function formatMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
}

function writeLog(level, message, data = null) {
  const logMessage = formatMessage(level, message, data);
  console.log(logMessage);
  logStream.write(logMessage);
}

const logger = {
  debug: (message, data = null) => writeLog('DEBUG', message, data),
  info: (message, data = null) => writeLog('INFO', message, data),
  warn: (message, data = null) => writeLog('WARN', message, data),
  error: (message, data = null) => writeLog('ERROR', message, data),
  monitorVariable: (variableName, initialValue) => {
    let currentValue = initialValue;
    return {
      get value() { return currentValue; },
      set value(newValue) {
        writeLog('INFO', `Variable ${variableName} changed`, {
          oldValue: currentValue,
          newValue
        });
        currentValue = newValue;
      }
    };
  }
};

export default logger;
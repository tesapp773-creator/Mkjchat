const CONFIG = require("./config");

function timestamp() {
  return new Date().toISOString();
}

function format(level, requestId, message) {
  if (requestId) {
    return `[${level}] ${timestamp()} [${requestId}] ${message}`;
  }

  return `[${level}] ${timestamp()} ${message}`;
}

function info(requestId, ...args) {
  if (!CONFIG.ENABLE_LOGGING) return;

  console.log(
    format("INFO", requestId, ""),
    ...args
  );
}

function warn(requestId, ...args) {
  if (!CONFIG.ENABLE_LOGGING) return;

  console.warn(
    format("WARN", requestId, ""),
    ...args
  );
}

function error(requestId, ...args) {
  if (!CONFIG.ENABLE_LOGGING) return;

  console.error(
    format("ERROR", requestId, ""),
    ...args
  );
}

module.exports = {
  info,
  warn,
  error
};

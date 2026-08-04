const crypto = require("crypto");

function generateRequestId() {
  // Node.js 16+
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback
  return (
    Date.now().toString(36) +
    "-" +
    crypto.randomBytes(6).toString("hex")
  );
}

module.exports = {
  generateRequestId
};

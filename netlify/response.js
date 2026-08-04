const CONSTANTS = require("./constants");

function success(requestId, data) {
  return {
    statusCode: CONSTANTS.HTTP.OK,
    headers: {
      "Content-Type": CONSTANTS.CONTENT_TYPE
    },
    body: JSON.stringify({
      success: true,
      requestId,
      ...data
    })
  };
}

function error(requestId, statusCode, message) {
  return {
    statusCode,
    headers: {
      "Content-Type": CONSTANTS.CONTENT_TYPE
    },
    body: JSON.stringify({
      success: false,
      requestId,
      error: message
    })
  };
}

module.exports = {
  success,
  error
};

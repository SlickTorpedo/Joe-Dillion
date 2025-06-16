const { Logtail } = require('@logtail/node');
const env_manager = require("../env_manager.js");

const LOGTAIL_TOKEN = env_manager.getEnvValue("LOGTAIL_TOKEN");
const LOGTAIL_INGESTING_HOST = env_manager.getEnvValue("LOGTAIL_INGESTING_HOST");
let logtail;
let use_logtail = true;
if (!LOGTAIL_TOKEN || LOGTAIL_TOKEN === "your-logtail-token") {
    console.warn("No logtail token was provided. Logging to console only.");
    use_logtail = false;
} else {
    logtail = new Logtail(LOGTAIL_TOKEN, {
      endpoint: `https://${LOGTAIL_INGESTING_HOST}/`,
    });
}

// Custom logger function
const logger = {
  info: (message) => {
    if (use_logtail) {
        logtail.info(message); // Log to Logtail
    }
    console.log(message); // Log to console
  },
  error: (message) => {
    if (use_logtail) {
        logtail.error(message); // Log to Logtail
    }
    console.error(message); // Log to console
  },
  warn: (message) => {
    if (use_logtail) {
        logtail.warn(message); // Log to Logtail
    }
    console.warn(message); // Log to console
  },
  // Add other log levels as needed
};

module.exports = logger;
const logger = require("./logger.js");
logger.info("[DATABASE] Loading database...");
const env_manager = require("../env_manager.js");
logger.info("[DATABASE] Loading environment manager...");
const redis = require("redis");
logger.info("[DATABASE] Importing redis...");
const client = redis.createClient();


var DETAILED_LOGS;
if(env_manager.isDevEnvironment()) {
    DETAILED_LOGS = true;
} else {
    DETAILED_LOGS = false;
}

async function connectRedis() {
    try {
        logger.info("[DATABASE] Connecting to Redis...");
        await client.connect();
        logger.info("[DATABASE] Connected to Redis");
    } catch (err) {
        failRedis(err);
    }
}

function failRedis(fail_redis_input) {
    logger.error(`[DATABASE] Failed to connect to Redis: ${fail_redis_input}`);
    logger.warn(`[DATABASE] Try running the scripts/install_redis.sh script to install Redis`);
    logger.warn(`[DATABASE] bash ../scripts/start_redis.sh`);
    process.exit(1);
}

client.on(`error`, err => failRedis(err));

// Utility function to sanitize or mask sensitive values
function sanitizeValue(key, value) {
    const sensitiveKeys = ["password", "token", "secret"]; // Add keys that should be masked
    if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey))) {
        return "[SENSITIVE]";
    }
    return value;
}

// Ensure Redis is connected before exporting
connectRedis();

module.exports = {
    ttl: async (key) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Checking TTL for key: ${key}`);
            const ttl = await client.ttl(key);
            if (DETAILED_LOGS) logger.info(`[DATABASE] TTL for key ${key}: ${ttl}`);
            return ttl;
        } catch (err) {
            logger.error(`[DATABASE] Error in TTL for key ${key}: ${err}`);
            throw err;
        }
    },
    get: async (key) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Getting value for key: ${key}`);
            const value = await client.get(key);
            if (DETAILED_LOGS) {
                const sanitizedValue = sanitizeValue(key, value);
                logger.info(`[DATABASE] Value for key ${key}: ${sanitizedValue}`);
            }
            return value;
        } catch (err) {
            logger.error(`[DATABASE] Error in GET for key ${key}: ${err}`);
            throw err;
        }
    },
        set: async (key, value, mode, duration) => {
        try {
            if (mode === "EX" && duration) {
                // Use Redis client syntax for setting expiration
                await client.set(key, value, { EX: duration });
            } else {
                await client.set(key, value); // Fallback for keys without expiration
            }
            if (DETAILED_LOGS) {
                const sanitizedValue = sanitizeValue(key, value);
                logger.info(`[DATABASE] Setting key: ${key} with value: ${sanitizedValue}, mode: ${mode}, duration: ${duration}`);
            }
            logger.info(`[DATABASE] Key ${key} set successfully`);
        } catch (err) {
            logger.error(`[DATABASE] Error in SET for key ${key}: ${err}`);
            throw err;
        }
    },
    del: async (key) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Deleting key: ${key}`);
            await client.del(key);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Key ${key} deleted successfully`);
        } catch (err) {
            logger.error(`[DATABASE] Error in DEL for key ${key}: ${err}`);
            throw err;
        }
    },
    keys: async (pattern) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Getting keys with pattern: ${pattern}`);
            const keys = await client.keys(pattern);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Keys found: ${keys}`);
            return keys;
        } catch (err) {
            logger.error(`[DATABASE] Error in KEYS for pattern ${pattern}: ${err}`);
            throw err;
        }
    },
    exists: async (key) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Checking existence of key: ${key}`);
            const exists = await client.exists(key);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Key ${key} exists: ${exists}`);
            return exists;
        } catch (err) {
            logger.error(`[DATABASE] Error in EXISTS for key ${key}: ${err}`);
            throw err;
        }
    },
    scard: async (key) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Getting card for key: ${key}`);
            const card = await client.sCard(key);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Card for key ${key}: ${card}`);
            return card;
        } catch (err) {
            logger.error(`[DATABASE] Error in SCARD for key ${key}: ${err}`);
            throw err;
        }
    },
    smembers: async (key) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Getting smembers for key: ${key}`);
            const members = await client.sMembers(key);
            if (DETAILED_LOGS) logger.info(`[DATABASE] smembers for key ${key}: ${members}`);
            return members;
        } catch (err) {
            logger.error(`[DATABASE] Error in SMEMBERS for key ${key}: ${err}`);
            throw err;
        }
    },
    sadd: async (key, value) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Adding value to set for key: ${key}`);
            await client.sAdd(key, value);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Value ${value} added to set for key ${key}`);
        } catch (err) {
            logger.error(`[DATABASE] Error in SADD for key ${key}: ${err}`);
            throw err;
        }
    },
    srem: async (key, value) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Removing value from set for key: ${key}`);
            await client.sRem(key, value);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Value ${value} removed from set for key ${key}`);
        } catch (err) {
            logger.error(`[DATABASE] Error in SREM for key ${key}: ${err}`);
            throw err;
        }
    },
    zadd: async (key, score, value) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Adding value to sorted set for key: ${key}`);
            await client.zAdd(key, { score, value });
            if (DETAILED_LOGS) logger.info(`[DATABASE] Value ${value} added to sorted set for key ${key}`);
        } catch (err) {
            logger.error(`[DATABASE] Error in ZADD for key ${key}: ${err}`);
            throw err;
        }
    },
    zrevrange: async (key, start, stop) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Getting reverse range for sorted set key: ${key}`);
            const range = await client.zRevRange(key, start, stop);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Reverse range for key ${key}: ${range}`);
            return range;
        } catch (err) {
            logger.error(`[DATABASE] Error in ZREVRANGE for key ${key}: ${err}`);
            throw err;
        }
    },
    zRevRange: async (key, start, stop, withScores = false) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Getting reverse range with scores for sorted set key: ${key}`);
            const range = await client.zRevRange(key, start, stop);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Reverse range with scores for key ${key}: ${range}`);
            return range;
        } catch (err) {
            logger.error(`[DATABASE] Error in ZREVRange for key ${key}: ${err}`);
            throw err;
        }
    },
    zcount: async (key, min, max) => {
        try {
            if (DETAILED_LOGS) logger.info(`[DATABASE] Counting elements in sorted set for key: ${key}`);
            const count = await client.zCount(key, min, max);
            if (DETAILED_LOGS) logger.info(`[DATABASE] Count for key ${key}: ${count}`);
            return count;
        } catch (err) {
            logger.error(`[DATABASE] Error in ZCOUNT for key ${key}: ${err}`);
            throw err;
        }
    }
};
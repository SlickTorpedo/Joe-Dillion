// Read from the .env file
require('dotenv').config({ path: __dirname + '/.env' });

function getEnvValue(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
}

function isDevEnvironment() {
    // Check if the NODE_ENV is set to 'development'
    return process.env.NODE_ENV === 'development';
}

module.exports = {
    getEnvValue,
    isDevEnvironment
};
const fs = require("fs");
const path = require("path");

function getCachePath(folder, key) {
    return path.join(__dirname, "../../cache", folder, `${key}.json`);
}

function readCache(folder, key) {
    const filePath = getCachePath(folder, key);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath));
    }
    return null;
}

function writeCache(folder, key, data) {
    const filePath = getCachePath(folder, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readCache, writeCache };
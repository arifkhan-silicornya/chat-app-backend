// server/datastore.js
const fs = require("fs");
const path = require("path");
const DB_AUTH_PATH = path.join(__dirname, "data", "db_auth.json");
const DB_SESSIONS_PATH = path.join(__dirname, "data", "db_sessions.json");
const DB_CHATS_PATH = path.join(__dirname, "data", "db_chats.json");

const getPAth = (file) => {
  if (file === "chats") {
    return DB_CHATS_PATH;
  } else if (file === "sessions") {
    return DB_SESSIONS_PATH;
  } else if (file === "users") {
    return DB_AUTH_PATH;
  } else {
    return null;
  }
};

function readDB(file) {
  const filePath = getPAth(file);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw || "{}");
}

function writeDB(db, file) {
  const filePath = getPAth(file);
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
}

module.exports = { readDB, writeDB };

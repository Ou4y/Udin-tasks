require("dotenv").config({ quiet: true });

const mysql = require("mysql2/promise");

const databaseName = process.env.DB_DATABASE || "sokoban";

if (!/^[a-zA-Z0-9_$]+$/.test(databaseName)) {
  throw new Error("DB_DATABASE may only contain letters, numbers, underscores, or dollar signs.");
}

const baseConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root"
};

const pool = mysql.createPool({
  ...baseConfig,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  multipleStatements: true
});

async function ensureDatabase() {
  const connection = await mysql.createConnection(baseConfig);

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

module.exports = {
  databaseName,
  ensureDatabase,
  pool
};

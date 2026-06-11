require("dotenv").config({ quiet: true });

const fs = require("fs/promises");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require("cors");
const express = require("express");
const session = require("express-session");

const { ensureDatabase, pool } = require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);
const bcryptRounds = Number(process.env.BCRYPT_ROUNDS || 10);

const DEFAULT_LEVEL = [
  "#######",
  "#     #",
  "#  .  #",
  "#  $  #",
  "#  @  #",
  "#     #",
  "#######"
];

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "sokoban.sid",
    secret: process.env.SESSION_SECRET || "dev-only-change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true"
    }
  })
);

function sendError(res, status, message, details) {
  return res.status(status).json({
    error: {
      message,
      ...(details ? { details } : {})
    }
  });
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

function parseJsonField(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

function getObjectBody(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return null;
  }

  return req.body;
}

function isValidUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 100;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateLevelName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= 120;
}

function validateGridData(gridData) {
  if (!Array.isArray(gridData) || gridData.length === 0 || gridData.length > 100) {
    return "grid_data must be a non-empty array of row strings.";
  }

  const width = typeof gridData[0] === "string" ? gridData[0].length : 0;
  if (width === 0 || width > 100) {
    return "grid_data rows must be 1 to 100 characters wide.";
  }

  const allowedCells = new Set(["#", " ", ".", "$", "@", "+", "*"]);
  let players = 0;
  let boxes = 0;
  let goals = 0;

  for (const row of gridData) {
    if (typeof row !== "string" || row.length !== width) {
      return "Every grid_data row must be a string with the same width.";
    }

    for (const cell of row) {
      if (!allowedCells.has(cell)) {
        return "grid_data contains an unsupported Sokoban cell.";
      }

      if (cell === "@" || cell === "+") {
        players += 1;
      }
      if (cell === "$" || cell === "*") {
        boxes += 1;
      }
      if (cell === "." || cell === "+" || cell === "*") {
        goals += 1;
      }
    }
  }

  if (players !== 1) {
    return "grid_data must contain exactly one player cell (@ or +).";
  }
  if (boxes < 1) {
    return "grid_data must contain at least one box ($ or *).";
  }
  if (goals < boxes) {
    return "grid_data must contain at least as many goals as boxes.";
  }

  return null;
}

// Auth is session-based. After register/login, a small public user object is
// stored in req.session.user and reused by later requests with the session cookie.
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return sendError(res, 401, "Authentication required.");
  }

  return next();
}

// Role checks live at the route boundary. Anonymous users have no session,
// players can submit scores, and admins can create levels plus submit scores.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return sendError(res, 401, "Authentication required.");
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return sendError(res, 403, "You do not have permission to perform this action.");
    }

    return next();
  };
}

app.post("/api/register", async (req, res, next) => {
  try {
    const body = getObjectBody(req);
    if (!body) {
      return sendError(res, 400, "Request body must be a JSON object.");
    }

    const { username, password } = body;
    if (!isValidUsername(username)) {
      return sendError(res, 400, "Username must be 3-30 characters and use only letters, numbers, or underscores.");
    }
    if (!isValidPassword(password)) {
      return sendError(res, 400, "Password must be 6-100 characters.");
    }

    const passwordHash = await bcrypt.hash(password, bcryptRounds);

    try {
      const [result] = await pool.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'player')",
        [username, passwordHash]
      );

      const user = { id: result.insertId, username, role: "player" };
      req.session.user = user;

      return res.status(201).json({ user });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return sendError(res, 409, "Username is already taken.");
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const body = getObjectBody(req);
    if (!body) {
      return sendError(res, 400, "Request body must be a JSON object.");
    }

    const { username, password } = body;
    if (!isValidUsername(username) || !isValidPassword(password)) {
      return sendError(res, 400, "Valid username and password are required.");
    }

    const [rows] = await pool.execute(
      "SELECT id, username, password_hash, role FROM users WHERE username = ?",
      [username]
    );
    const user = rows[0];

    if (!user) {
      return sendError(res, 401, "Invalid username or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return sendError(res, 401, "Invalid username or password.");
    }

    const publicUser = toPublicUser(user);

    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      req.session.user = publicUser;
      return res.json({ user: publicUser });
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/logout", requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("sokoban.sid");
    return res.json({ message: "Logged out." });
  });
});

app.get("/api/me", (req, res) => {
  return res.json({ user: req.session.user || null });
});

// Levels are public so anonymous users can select and play them as guests.
app.get("/api/levels", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        levels.id,
        levels.name,
        levels.grid_data,
        levels.created_at,
        users.username AS created_by
      FROM levels
      LEFT JOIN users ON users.id = levels.created_by
      ORDER BY levels.created_at ASC, levels.id ASC`
    );

    return res.json({
      levels: rows.map((level) => ({
        ...level,
        grid_data: parseJsonField(level.grid_data)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

// Admin-only level creation remains protected at the route boundary.
app.post("/api/levels", requireRole("admin"), async (req, res, next) => {
  try {
    const body = getObjectBody(req);
    if (!body) {
      return sendError(res, 400, "Request body must be a JSON object.");
    }

    const { name, grid_data: gridData } = body;
    if (!validateLevelName(name)) {
      return sendError(res, 400, "Level name is required and must be 120 characters or less.");
    }

    const gridError = validateGridData(gridData);
    if (gridError) {
      return sendError(res, 400, gridError);
    }

    try {
      const [result] = await pool.execute(
        "INSERT INTO levels (name, grid_data, created_by) VALUES (?, ?, ?)",
        [name.trim(), JSON.stringify(gridData), req.session.user.id]
      );

      return res.status(201).json({
        level: {
          id: result.insertId,
          name: name.trim(),
          grid_data: gridData,
          created_by: req.session.user.username
        }
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return sendError(res, 409, "A level with that name already exists.");
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

// Score saving requires login. Guests can complete levels client-side, but
// anonymous POST /api/scores requests are rejected by requireRole.
app.post("/api/scores", requireRole("player", "admin"), async (req, res, next) => {
  try {
    const body = getObjectBody(req);
    if (!body) {
      return sendError(res, 400, "Request body must be a JSON object.");
    }

    const { level_id: levelId, moves } = body;
    if (!isPositiveInteger(levelId)) {
      return sendError(res, 400, "level_id must be a positive integer.");
    }
    if (!isPositiveInteger(moves)) {
      return sendError(res, 400, "moves must be a positive integer.");
    }

    const [levels] = await pool.execute("SELECT id FROM levels WHERE id = ?", [levelId]);
    if (levels.length === 0) {
      return sendError(res, 404, "Level not found.");
    }

    const [result] = await pool.execute(
      "INSERT INTO scores (user_id, level_id, moves) VALUES (?, ?, ?)",
      [req.session.user.id, levelId, moves]
    );

    return res.status(201).json({
      score: {
        id: result.insertId,
        user_id: req.session.user.id,
        level_id: levelId,
        moves
      }
    });
  } catch (error) {
    return next(error);
  }
});

// The leaderboard is public; it only displays persisted authenticated scores.
app.get("/api/leaderboard", async (_req, res, next) => {
  try {
    // Leaderboard logic: return each user's best score per level. A score is
    // hidden if the same user has a lower move count for that level, or an
    // equal move count submitted earlier.
    const [rows] = await pool.execute(
      `SELECT
        scores.id,
        users.username,
        levels.id AS level_id,
        levels.name AS level_name,
        scores.moves,
        scores.completed_at
      FROM scores
      JOIN users ON users.id = scores.user_id
      JOIN levels ON levels.id = scores.level_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM scores AS better_scores
        WHERE better_scores.user_id = scores.user_id
          AND better_scores.level_id = scores.level_id
          AND (
            better_scores.moves < scores.moves
            OR (
              better_scores.moves = scores.moves
              AND (
                better_scores.completed_at < scores.completed_at
                OR (
                  better_scores.completed_at = scores.completed_at
                  AND better_scores.id < scores.id
                )
              )
            )
          )
      )
      ORDER BY scores.moves ASC, scores.completed_at ASC, scores.id ASC
      LIMIT 50`
    );

    return res.json({ leaderboard: rows });
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
});

app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") {
    return sendError(res, 400, "Request body must be valid JSON.");
  }

  console.error(error);
  return sendError(res, 500, "Internal server error.");
});

async function runSchema() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  await pool.query(schemaSql);
}

async function ensureSeedData() {
  const [adminRows] = await pool.execute("SELECT id FROM users WHERE username = 'admin'");
  let adminId = adminRows[0]?.id;

  if (!adminId) {
    const passwordHash = await bcrypt.hash("admin123", bcryptRounds);
    const [result] = await pool.execute(
      "INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')",
      [passwordHash]
    );
    adminId = result.insertId;
  }

  const [levelRows] = await pool.execute("SELECT id FROM levels WHERE name = 'Starter Push'");
  if (levelRows.length === 0) {
    await pool.execute(
      "INSERT INTO levels (name, grid_data, created_by) VALUES ('Starter Push', ?, ?)",
      [JSON.stringify(DEFAULT_LEVEL), adminId]
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function initializeDatabaseWithRetry() {
  const maxAttempts = Number(process.env.DB_STARTUP_ATTEMPTS || 30);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await ensureDatabase();
      await runSchema();
      await ensureSeedData();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.log(`Waiting for MySQL to be ready (${attempt}/${maxAttempts})...`);
      await sleep(1000);
    }
  }
}

async function start() {
  await initializeDatabaseWithRetry();

  app.listen(port, () => {
    console.log(`Sokoban backend listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

module.exports = app;

const API_BASE = "http://localhost:4000/api";

const TILE = {
  WALL: "#",
  FLOOR: " ",
  TARGET: ".",
  BOX: "$",
  BOX_ON_TARGET: "*",
  PLAYER: "@",
  PLAYER_ON_TARGET: "+"
};

const DIRECTIONS = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 }
};

const state = {
  user: null,
  levels: [],
  leaderboard: [],
  selectedLevel: null,
  level: [],
  playerPosition: { row: 0, col: 0 },
  moves: 0,
  hasWon: false,
  submittingScore: false
};

const elements = {
  message: document.getElementById("message"),
  sessionStatus: document.getElementById("session-status"),
  anonymousAuth: document.getElementById("anonymous-auth"),
  registerForm: document.getElementById("register-form"),
  loginForm: document.getElementById("login-form"),
  userPanel: document.getElementById("user-panel"),
  userName: document.getElementById("user-name"),
  userRole: document.getElementById("user-role"),
  logoutButton: document.getElementById("logout-button"),
  refreshButton: document.getElementById("refresh-button"),
  leaderboardRefresh: document.getElementById("leaderboard-refresh"),
  levelsRefresh: document.getElementById("levels-refresh"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  levelsList: document.getElementById("levels-list"),
  gameTitle: document.getElementById("game-title"),
  gameMessage: document.getElementById("game-message"),
  moves: document.getElementById("moves"),
  restartButton: document.getElementById("restart-button"),
  board: document.getElementById("board"),
  adminSection: document.getElementById("admin-section"),
  levelForm: document.getElementById("level-form")
};

function setMessage(text, type = "") {
  elements.message.textContent = text;
  elements.message.className = `message ${type}`.trim();
}

function setGameMessage(text, type = "") {
  elements.gameMessage.textContent = text;
  elements.gameMessage.className = `game-message ${type}`.trim();
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error?.message || `Request failed with ${response.status}`);
  }

  return data;
}

function canSaveScore() {
  // Anonymous users can play as guests; saving scores requires a player/admin session.
  return state.user?.role === "player" || state.user?.role === "admin";
}

function renderAuth() {
  if (!state.user) {
    elements.sessionStatus.textContent = "Anonymous";
    elements.anonymousAuth.hidden = false;
    elements.userPanel.hidden = true;
    elements.adminSection.hidden = true;
    return;
  }

  elements.sessionStatus.textContent = "Signed in";
  elements.userName.textContent = state.user.username;
  elements.userRole.textContent = state.user.role;
  elements.anonymousAuth.hidden = true;
  elements.userPanel.hidden = false;
  elements.adminSection.hidden = state.user.role !== "admin";
}

function renderLeaderboard() {
  if (state.leaderboard?.length) {
    elements.leaderboardBody.innerHTML = "";

    state.leaderboard.forEach((score) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(score.username)}</td>
        <td>${escapeHtml(score.level_name)}</td>
        <td>${score.moves}</td>
        <td>${formatDate(score.completed_at)}</td>
      `;
      elements.leaderboardBody.appendChild(row);
    });
    return;
  }

  elements.leaderboardBody.innerHTML = '<tr><td colspan="4">No scores yet.</td></tr>';
}

function renderLevels() {
  elements.levelsList.innerHTML = "";

  if (state.levels.length === 0) {
    elements.levelsList.textContent = "No levels available.";
    return;
  }

  state.levels.forEach((level) => {
    const card = document.createElement("article");
    card.className = "level-card";
    if (state.selectedLevel?.id === level.id) {
      card.classList.add("selected");
    }

    const rows = Array.isArray(level.grid_data) ? level.grid_data.length : 0;
    const cols = rows > 0 ? level.grid_data[0].length : 0;
    const creator = level.created_by || "system";

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(level.name)}</h3>
        <p>${rows} x ${cols} grid by ${escapeHtml(creator)}</p>
      </div>
      <button type="button" data-level-id="${level.id}">Play</button>
    `;

    elements.levelsList.appendChild(card);
  });
}

function renderGame() {
  elements.moves.textContent = state.moves;
  elements.restartButton.disabled = !state.selectedLevel;

  document.querySelectorAll("[data-move]").forEach((button) => {
    button.disabled = !state.selectedLevel || state.hasWon;
  });

  if (!state.selectedLevel) {
    elements.gameTitle.textContent = "Select a level.";
    elements.board.innerHTML = "";
    return;
  }

  elements.gameTitle.textContent = state.selectedLevel.name;
  renderBoard();
}

function renderAll() {
  renderAuth();
  renderLeaderboard();
  renderLevels();
  renderGame();
}

async function loadSession() {
  const data = await api("/me");
  state.user = data.user;
}

async function loadLevels() {
  const data = await api("/levels");
  state.levels = data.levels || [];

  if (state.selectedLevel) {
    state.selectedLevel = state.levels.find((level) => level.id === state.selectedLevel.id) || null;
    if (!state.selectedLevel) {
      state.level = [];
      state.moves = 0;
      state.hasWon = false;
      setGameMessage("");
    }
  }
}

async function loadLeaderboard() {
  const data = await api("/leaderboard");
  state.leaderboard = data.leaderboard || [];
}

async function refreshAll(showSuccess = false) {
  try {
    await Promise.all([loadSession(), loadLevels(), loadLeaderboard()]);
    renderAll();
    if (showSuccess) {
      setMessage("Dashboard refreshed.", "success");
    }
  } catch (error) {
    renderAll();
    setMessage(error.message, "error");
  }
}

async function submitAuth(event, path) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const username = formData.get("username").trim();
  const password = formData.get("password");

  try {
    const data = await api(path, {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    state.user = data.user;
    form.reset();
    setMessage(`Signed in as ${state.user.username}.`, "success");
    renderAll();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function logout() {
  try {
    await api("/logout", { method: "POST" });
    state.user = null;
    state.selectedLevel = null;
    state.level = [];
    state.moves = 0;
    state.hasWon = false;
    setGameMessage("");
    setMessage("Logged out.", "success");
    renderAll();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function selectLevel(levelId) {
  const level = state.levels.find((item) => item.id === levelId);
  if (!level) {
    setMessage("Level not found.", "error");
    return;
  }

  state.selectedLevel = level;
  resetGame();
  setMessage(`Loaded ${level.name}.`, "success");
}

function resetGame() {
  if (!state.selectedLevel) {
    return;
  }

  state.level = state.selectedLevel.grid_data.map((row) => Array.from(row));
  state.playerPosition = findPlayer();
  state.moves = 0;
  state.hasWon = false;
  state.submittingScore = false;
  setGameMessage("");
  renderAll();
}

function findPlayer() {
  for (let row = 0; row < state.level.length; row += 1) {
    for (let col = 0; col < state.level[row].length; col += 1) {
      const tile = state.level[row][col];
      if (tile === TILE.PLAYER || tile === TILE.PLAYER_ON_TARGET) {
        return { row, col };
      }
    }
  }

  return { row: 0, col: 0 };
}

function renderBoard() {
  elements.board.innerHTML = "";
  if (state.level.length === 0) {
    return;
  }

  elements.board.style.gridTemplateColumns = `repeat(${state.level[0].length}, clamp(30px, 7vw, 48px))`;

  state.level.forEach((row) => {
    row.forEach((tile) => {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (tile === TILE.WALL) {
        cell.classList.add("wall");
      }

      if (tile === TILE.TARGET || tile === TILE.BOX_ON_TARGET || tile === TILE.PLAYER_ON_TARGET) {
        cell.classList.add("target");
      }

      if (tile === TILE.BOX || tile === TILE.BOX_ON_TARGET) {
        const box = document.createElement("div");
        box.className = tile === TILE.BOX_ON_TARGET ? "box on-target" : "box";
        cell.appendChild(box);
      }

      if (tile === TILE.PLAYER || tile === TILE.PLAYER_ON_TARGET) {
        const player = document.createElement("div");
        player.className = "player";
        cell.appendChild(player);
      }

      elements.board.appendChild(cell);
    });
  });
}

function getTile(row, col) {
  if (!state.level[row] || state.level[row][col] === undefined) {
    return TILE.WALL;
  }

  return state.level[row][col];
}

function isOpenTile(tile) {
  return tile === TILE.FLOOR || tile === TILE.TARGET;
}

function isBox(tile) {
  return tile === TILE.BOX || tile === TILE.BOX_ON_TARGET;
}

function removePlayerFrom(tile) {
  return tile === TILE.PLAYER_ON_TARGET ? TILE.TARGET : TILE.FLOOR;
}

function addPlayerTo(tile) {
  return tile === TILE.TARGET ? TILE.PLAYER_ON_TARGET : TILE.PLAYER;
}

function removeBoxFrom(tile) {
  return tile === TILE.BOX_ON_TARGET ? TILE.TARGET : TILE.FLOOR;
}

function addBoxTo(tile) {
  return tile === TILE.TARGET ? TILE.BOX_ON_TARGET : TILE.BOX;
}

function movePlayer(rowDelta, colDelta) {
  if (state.hasWon || !state.selectedLevel) {
    return;
  }

  const currentRow = state.playerPosition.row;
  const currentCol = state.playerPosition.col;
  const nextRow = currentRow + rowDelta;
  const nextCol = currentCol + colDelta;
  const nextTile = getTile(nextRow, nextCol);

  if (isOpenTile(nextTile)) {
    state.level[currentRow][currentCol] = removePlayerFrom(state.level[currentRow][currentCol]);
    state.level[nextRow][nextCol] = addPlayerTo(nextTile);
    state.playerPosition = { row: nextRow, col: nextCol };
    finishTurn();
    return;
  }

  if (isBox(nextTile)) {
    const boxRow = nextRow + rowDelta;
    const boxCol = nextCol + colDelta;
    const boxDestination = getTile(boxRow, boxCol);

    if (!isOpenTile(boxDestination)) {
      return;
    }

    state.level[boxRow][boxCol] = addBoxTo(boxDestination);
    state.level[nextRow][nextCol] = addPlayerTo(removeBoxFrom(nextTile));
    state.level[currentRow][currentCol] = removePlayerFrom(state.level[currentRow][currentCol]);
    state.playerPosition = { row: nextRow, col: nextCol };
    finishTurn();
  }
}

function finishTurn() {
  state.moves += 1;
  renderGame();
  checkWin();
}

function checkWin() {
  const allTargetsCovered = state.level.every((row) =>
    row.every((tile) => tile !== TILE.TARGET && tile !== TILE.PLAYER_ON_TARGET)
  );

  if (!allTargetsCovered) {
    return;
  }

  state.hasWon = true;
  renderGame();

  if (!canSaveScore()) {
    setGameMessage("Level completed! Login or register to save your score.", "success");
    return;
  }

  setGameMessage(`Solved in ${state.moves} moves. Submitting score...`, "success");
  submitScore();
}

async function submitScore() {
  if (state.submittingScore) {
    return;
  }

  state.submittingScore = true;
  const levelId = state.selectedLevel.id;
  const moves = state.moves;

  try {
    await api("/scores", {
      method: "POST",
      body: JSON.stringify({ level_id: levelId, moves })
    });
    await loadLeaderboard();
    renderLeaderboard();
    setGameMessage(`Solved in ${moves} moves. Score submitted.`, "success");
    setMessage("Score submitted and leaderboard refreshed.", "success");
  } catch (error) {
    setGameMessage(`Solved in ${moves} moves. Score was not submitted.`, "error");
    setMessage(error.message, "error");
  } finally {
    state.submittingScore = false;
    renderGame();
  }
}

async function createLevel(event) {
  event.preventDefault();
  const formData = new FormData(elements.levelForm);
  const name = formData.get("name").trim();
  const rawGrid = formData.get("grid").trim();
  let gridData;

  try {
    gridData = JSON.parse(rawGrid);
  } catch (_error) {
    setMessage("Grid must be valid JSON.", "error");
    return;
  }

  try {
    await api("/levels", {
      method: "POST",
      body: JSON.stringify({ name, grid_data: gridData })
    });
    elements.levelForm.reset();
    await loadLevels();
    renderLevels();
    setMessage("Level created and level list refreshed.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.registerForm.addEventListener("submit", (event) => submitAuth(event, "/register"));
elements.loginForm.addEventListener("submit", (event) => submitAuth(event, "/login"));
elements.logoutButton.addEventListener("click", logout);
elements.refreshButton.addEventListener("click", () => refreshAll(true));
elements.leaderboardRefresh.addEventListener("click", async () => {
  try {
    await loadLeaderboard();
    renderLeaderboard();
    setMessage("Leaderboard refreshed.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});
elements.levelsRefresh.addEventListener("click", async () => {
  try {
    await loadLevels();
    renderLevels();
    setMessage("Levels refreshed.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});
elements.restartButton.addEventListener("click", resetGame);
elements.levelForm.addEventListener("submit", createLevel);
elements.levelsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-level-id]");
  if (!button) {
    return;
  }

  selectLevel(Number(button.dataset.levelId));
});
document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("click", () => {
    const moves = {
      up: DIRECTIONS.ArrowUp,
      down: DIRECTIONS.ArrowDown,
      left: DIRECTIONS.ArrowLeft,
      right: DIRECTIONS.ArrowRight
    };
    const direction = moves[button.dataset.move];
    movePlayer(direction.row, direction.col);
  });
});
document.addEventListener("keydown", (event) => {
  const direction = DIRECTIONS[event.key];
  const target = event.target.tagName.toLowerCase();

  if (!direction || target === "input" || target === "textarea") {
    return;
  }

  event.preventDefault();
  movePlayer(direction.row, direction.col);
});

refreshAll();

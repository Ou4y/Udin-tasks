const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = 3000;
const ROOM_NAME = 'main-room';
const COUNTDOWN_MS = 5000;
const ROUND_DURATION_MS = 15000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const players = new Map();

let gameState = 'waiting';
let currentRound = null;
let endTimer = null;

function getPlayersList() {
  return Array.from(players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    taps: player.taps,
  }));
}

function getLeaderboard() {
  return getPlayersList().sort((a, b) => {
    if (b.taps !== a.taps) return b.taps - a.taps;
    return a.name.localeCompare(b.name);
  });
}

function getRoundPayload() {
  if (!currentRound) {
    return null;
  }

  return {
    ...currentRound,
    serverNow: Date.now(),
  };
}

function emitPlayers() {
  io.to(ROOM_NAME).emit('playersUpdated', {
    players: getPlayersList(),
    canStart: players.size >= 2 && gameState !== 'scheduled' && gameState !== 'playing',
    gameState,
  });
}

function emitLeaderboard() {
  io.to(ROOM_NAME).emit('leaderboardUpdated', {
    leaderboard: getLeaderboard(),
  });
}

function endGame() {
  if (!currentRound || gameState === 'ended') {
    return;
  }

  gameState = 'ended';
  const ranking = getLeaderboard();
  const highestScore = ranking[0]?.taps ?? 0;
  const winners = ranking.filter((player) => player.taps === highestScore);

  io.to(ROOM_NAME).emit('gameEnded', {
    ranking,
    winner: winners.length === 1 ? winners[0] : null,
    winners,
    endedAt: Date.now(),
  });

  emitPlayers();
}

function scheduleGame() {
  if (players.size < 2) {
    return { ok: false, message: 'At least 2 players are required to start.' };
  }

  if (gameState === 'scheduled' || gameState === 'playing') {
    return { ok: false, message: 'A round is already running.' };
  }

  for (const player of players.values()) {
    player.taps = 0;
  }

  // Date.now() returns UTC-based milliseconds since the Unix epoch.
  // Timezones do not matter here because the server sends absolute timestamps.
  const startAt = Date.now() + COUNTDOWN_MS;
  const durationMs = ROUND_DURATION_MS;
  const endAt = startAt + durationMs;

  currentRound = { startAt, endAt, durationMs };
  gameState = 'scheduled';

  if (endTimer) {
    clearTimeout(endTimer);
  }

  io.to(ROOM_NAME).emit('gameScheduled', getRoundPayload());
  emitLeaderboard();
  emitPlayers();

  setTimeout(() => {
    if (!currentRound || currentRound.startAt !== startAt || gameState !== 'scheduled') {
      return;
    }

    gameState = 'playing';
    io.to(ROOM_NAME).emit('gameStarted', getRoundPayload());
    emitPlayers();
  }, Math.max(0, startAt - Date.now()));

  endTimer = setTimeout(() => {
    if (!currentRound || currentRound.endAt !== endAt) {
      return;
    }

    endGame();
  }, Math.max(0, endAt - Date.now()));

  return { ok: true };
}

io.on('connection', (socket) => {
  socket.on('joinGame', ({ name } = {}) => {
    const cleanName = String(name || '').trim().slice(0, 24);

    if (!cleanName) {
      socket.emit('errorMessage', 'Please enter a display name.');
      return;
    }

    const player = {
      id: socket.id,
      name: cleanName,
      taps: 0,
    };

    players.set(socket.id, player);
    socket.join(ROOM_NAME);

    socket.emit('playersUpdated', {
      players: getPlayersList(),
      canStart: players.size >= 2 && gameState !== 'scheduled' && gameState !== 'playing',
      gameState,
    });

    if (currentRound && gameState !== 'waiting') {
      if (gameState === 'ended') {
        const ranking = getLeaderboard();
        const highestScore = ranking[0]?.taps ?? 0;
        const winners = ranking.filter((existingPlayer) => existingPlayer.taps === highestScore);
        socket.emit('gameEnded', {
          ranking,
          winner: winners.length === 1 ? winners[0] : null,
          winners,
          endedAt: Date.now(),
        });
      } else if (gameState === 'playing') {
        socket.emit('gameStarted', getRoundPayload());
      } else {
        socket.emit('gameScheduled', getRoundPayload());
      }
    }

    emitPlayers();
    emitLeaderboard();
  });

  socket.on('startGame', () => {
    if (!players.has(socket.id)) {
      socket.emit('errorMessage', 'Join the game before starting a round.');
      return;
    }

    const result = scheduleGame();
    if (!result.ok) {
      socket.emit('errorMessage', result.message);
    }
  });

  socket.on('tap', () => {
    const player = players.get(socket.id);

    if (!player) {
      socket.emit('errorMessage', 'Join the game before tapping.');
      return;
    }

    if (!currentRound) {
      return;
    }

    const now = Date.now();

    // The server validates taps using its own clock, not the client's local time.
    // This rejects early/late taps even if a user changes their device clock.
    if (now < currentRound.startAt || now > currentRound.endAt) {
      return;
    }

    // Server-side counting prevents users from faking client-side scores.
    player.taps += 1;
    const leaderboard = getLeaderboard();

    socket.emit('leaderboardUpdated', {
      leaderboard,
      yourTaps: player.taps,
    });
    socket.to(ROOM_NAME).emit('leaderboardUpdated', {
      leaderboard,
    });
  });

  socket.on('disconnect', () => {
    const wasPlaying = players.delete(socket.id);

    if (!wasPlaying) {
      return;
    }

    if (players.size === 0) {
      gameState = 'waiting';
      currentRound = null;
      if (endTimer) {
        clearTimeout(endTimer);
        endTimer = null;
      }
    }

    emitPlayers();
    emitLeaderboard();
  });
});

server.listen(PORT, () => {
  console.log(`Task 3 multiplayer tap game running at http://localhost:${PORT}`);
});

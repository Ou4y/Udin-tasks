const socket = io();

const joinPanel = document.querySelector('#joinPanel');
const joinForm = document.querySelector('#joinForm');
const nameInput = document.querySelector('#nameInput');
const gamePanel = document.querySelector('#gamePanel');
const startButton = document.querySelector('#startButton');
const tapButton = document.querySelector('#tapButton');
const stateTitle = document.querySelector('#stateTitle');
const statusMessage = document.querySelector('#statusMessage');
const timerLabel = document.querySelector('#timerLabel');
const timerValue = document.querySelector('#timerValue');
const personalCount = document.querySelector('#personalCount');
const playersList = document.querySelector('#playersList');
const leaderboardList = document.querySelector('#leaderboardList');
const resultsPanel = document.querySelector('#resultsPanel');
const resultsList = document.querySelector('#resultsList');
const winnerText = document.querySelector('#winnerText');
const errorMessage = document.querySelector('#errorMessage');

let joined = false;
let myName = '';
let gameState = 'waiting';
let currentRound = null;
let timerInterval = null;
let localTapCount = 0;
let serverOffsetMs = 0;

function updateServerOffset(serverNow) {
  if (typeof serverNow === 'number') {
    serverOffsetMs = serverNow - Date.now();
  }
}

function getServerNow() {
  return Date.now() + serverOffsetMs;
}

function showError(message) {
  errorMessage.textContent = message;

  if (message) {
    setTimeout(() => {
      if (errorMessage.textContent === message) {
        errorMessage.textContent = '';
      }
    }, 3500);
  }
}

function formatSeconds(ms) {
  return Math.max(0, Math.ceil(ms / 1000)).toString();
}

function renderPlayers(players = []) {
  playersList.classList.toggle('empty-list', players.length === 0);
  playersList.innerHTML = '';

  if (players.length === 0) {
    playersList.innerHTML = '<li>No players yet.</li>';
    return;
  }

  for (const player of players) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const taps = document.createElement('strong');

    name.textContent = player.name;
    taps.textContent = player.taps.toString();
    item.append(name, taps);
    playersList.appendChild(item);
  }
}

function renderLeaderboard(list = [], target = leaderboardList) {
  target.classList.toggle('empty-list', list.length === 0);
  target.innerHTML = '';

  if (list.length === 0) {
    target.innerHTML = '<li>Scores appear when the round starts.</li>';
    return;
  }

  for (const player of list) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const taps = document.createElement('strong');

    name.textContent = player.name;
    taps.textContent = player.taps.toString();
    item.append(name, taps);
    target.appendChild(item);
  }
}

function updateTapAvailability() {
  const now = getServerNow();
  const canTap = joined && currentRound && now >= currentRound.startAt && now <= currentRound.endAt && gameState === 'playing';
  tapButton.disabled = !canTap;
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();

  function tick() {
    if (!currentRound) {
      timerLabel.textContent = 'Countdown';
      timerValue.textContent = '--';
      updateTapAvailability();
      return;
    }

    const now = getServerNow();

    if (now < currentRound.startAt) {
      stateTitle.textContent = 'Starting soon';
      statusMessage.textContent = 'Get ready. Tapping unlocks when the server start time arrives.';
      timerLabel.textContent = 'Starts in';
      timerValue.textContent = formatSeconds(currentRound.startAt - now);
    } else if (now <= currentRound.endAt) {
      stateTitle.textContent = 'Tap now';
      statusMessage.textContent = 'Press Space or click Tap. The server is counting every accepted tap.';
      timerLabel.textContent = 'Time left';
      timerValue.textContent = formatSeconds(currentRound.endAt - now);
    } else {
      stateTitle.textContent = 'Round ended';
      statusMessage.textContent = 'Waiting for final server results.';
      timerLabel.textContent = 'Time left';
      timerValue.textContent = '0';
    }

    updateTapAvailability();
  }

  tick();
  timerInterval = setInterval(tick, 100);
}

function resetRoundUi() {
  currentRound = null;
  gameState = 'waiting';
  localTapCount = 0;
  personalCount.textContent = '0';
  timerLabel.textContent = 'Countdown';
  timerValue.textContent = '--';
  stateTitle.textContent = 'Waiting room';
  statusMessage.textContent = 'Waiting for players to join.';
  tapButton.disabled = true;
  resultsPanel.classList.add('hidden');
  winnerText.textContent = 'Winner will appear here.';
}

function sendTap() {
  updateTapAvailability();

  if (tapButton.disabled) {
    return;
  }

  socket.emit('tap');
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  myName = nameInput.value.trim();
  socket.emit('joinGame', { name: myName });
});

startButton.addEventListener('click', () => {
  socket.emit('startGame');
});

tapButton.addEventListener('click', sendTap);

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) {
    return;
  }

  if (!joined || document.activeElement === nameInput) {
    return;
  }

  event.preventDefault();
  sendTap();
});

socket.on('playersUpdated', ({ players, canStart, gameState: serverState }) => {
  joined = joined || players.some((player) => player.id === socket.id);
  gameState = serverState || gameState;

  if (joined) {
    joinPanel.classList.add('hidden');
    gamePanel.classList.remove('hidden');
  }

  renderPlayers(players);
  startButton.disabled = !canStart;

  if (gameState === 'waiting' || gameState === 'ended') {
    statusMessage.textContent = canStart
      ? 'At least two players are connected. Any player can start the next round.'
      : 'Waiting for at least two connected players.';
  }
});

socket.on('gameScheduled', (round) => {
  updateServerOffset(round.serverNow);
  currentRound = round;
  gameState = 'scheduled';
  localTapCount = 0;
  personalCount.textContent = '0';
  startButton.disabled = true;
  resultsPanel.classList.add('hidden');
  statusMessage.textContent = 'Round scheduled by the server.';
  startTimer();
});

socket.on('gameStarted', (round) => {
  updateServerOffset(round.serverNow);
  currentRound = round;
  gameState = 'playing';
  statusMessage.textContent = 'Round is live.';
  startTimer();
  updateTapAvailability();
});

socket.on('leaderboardUpdated', ({ leaderboard, yourTaps }) => {
  renderLeaderboard(leaderboard);

  if (typeof yourTaps === 'number') {
    localTapCount = yourTaps;
    personalCount.textContent = localTapCount.toString();
  } else {
    const me = leaderboard.find((player) => player.id === socket.id);
    if (me) {
      localTapCount = me.taps;
      personalCount.textContent = localTapCount.toString();
    }
  }
});

socket.on('gameEnded', ({ ranking, winner, winners }) => {
  gameState = 'ended';
  stopTimer();
  updateTapAvailability();
  timerLabel.textContent = 'Finished';
  timerValue.textContent = '0';
  stateTitle.textContent = 'Round ended';
  statusMessage.textContent = 'Final results are in. Start another round when everyone is ready.';
  resultsPanel.classList.remove('hidden');

  renderLeaderboard(ranking, leaderboardList);
  renderLeaderboard(ranking, resultsList);

  if (winner) {
    winnerText.textContent = `${winner.name} wins with ${winner.taps} taps.`;
  } else if (winners && winners.length > 1) {
    winnerText.textContent = `Tie: ${winners.map((player) => player.name).join(', ')} with ${winners[0].taps} taps.`;
  } else {
    winnerText.textContent = 'No winner this round.';
  }
});

socket.on('errorMessage', showError);

socket.on('disconnect', () => {
  joined = false;
  resetRoundUi();
  joinPanel.classList.remove('hidden');
  gamePanel.classList.add('hidden');
  showError('Disconnected from the server. Refresh to rejoin.');
});

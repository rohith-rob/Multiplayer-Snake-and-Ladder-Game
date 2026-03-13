const socket = io();

let gameCode = null;
let playerId = null;
let playerName = null;
let isHost = false;
let currentPlayer = null;
let boardConfig = null;
let gameStarted = false;

document.getElementById('host-btn').addEventListener('click', () => {
    showScreen('host-setup');
});

document.getElementById('join-btn').addEventListener('click', () => {
    showScreen('join-page');
});

document.getElementById('back-home').addEventListener('click', () => {
    showScreen('home');
});

document.getElementById('back-home2').addEventListener('click', () => {
    showScreen('home');
});

document.getElementById('back-home3').addEventListener('click', () => {
    showScreen('home');
});

document.getElementById('create-game').addEventListener('click', () => {
    const name = document.getElementById('host-name').value.trim();
    const numPlayers = document.getElementById('num-players').value;
    if (name) {
        playerName = name;
        socket.emit('createGame', { name, numPlayers });
        isHost = true;
    }
});

document.getElementById('join-game').addEventListener('click', () => {
    const name = document.getElementById('join-name').value.trim();
    const code = document.getElementById('game-code').value.trim().toUpperCase();
    if (name && code) {
        playerName = name;
        socket.emit('joinGame', { name, code });
    }
});

document.getElementById('start-game').addEventListener('click', () => {
    socket.emit('startGame', { gameCode });
});

document.getElementById('roll-dice').addEventListener('click', () => {
    socket.emit('rollDice', { gameCode, playerId });
});

document.getElementById('restart-game').addEventListener('click', () => {
    socket.emit('restartGame', { gameCode });
});

function showScreen(screenId) {
    const screens = ['home', 'host-setup', 'join-page', 'lobby', 'game', 'winner'];
    screens.forEach(id => {
        document.getElementById(id).style.display = id === screenId ? 'block' : 'none';
    });
}

socket.on('gameCreated', (data) => {
    gameCode = data.code;
    playerId = data.playerId;
    boardConfig = data.board;
    document.getElementById('lobby-code').textContent = gameCode;
    showScreen('lobby');
    updateLobby(data.players);
    document.getElementById('host-controls').style.display = 'block';
    addLobbyMessage(`Game created. Waiting for players...`);
});

socket.on('gameJoined', (data) => {
    gameCode = data.code;
    playerId = data.playerId;
    boardConfig = data.board;
    document.getElementById('lobby-code').textContent = gameCode;
    showScreen('lobby');
    updateLobby(data.players);
    addLobbyMessage('Joined game. Waiting to start...');
});

socket.on('playerJoined', (data) => {
    updateLobby(data.players);
    addLobbyMessage(`${data.playerName} joined the game.`);
});

socket.on('gameStarted', (data) => {
    gameStarted = true;
    showScreen('game');
    createBoard(boardConfig);
    updateGame(data);
    addGameLog('Game started!');
});

socket.on('updateGame', (data) => {
    if (data.board) {
        boardConfig = data.board;
        createBoard(boardConfig);
    }
    updateBoard(data.players);
    updatePlayers(data.players);
    currentPlayer = data.currentPlayer;
    if (currentPlayer === playerId) {
        document.getElementById('roll-dice').disabled = false;
        addGameLog('Your turn! Roll the dice.');
    } else {
        document.getElementById('roll-dice').disabled = true;
    }
});

socket.on('diceRolled', (data) => {
    const diceElement = document.getElementById('dice-result');
    diceElement.textContent = `🎲 ${data.roll}`;
    diceElement.classList.add('rolling');
    setTimeout(() => diceElement.classList.remove('rolling'), 500);
    addGameLog(`${data.playerName} rolled ${data.roll}`);
});

socket.on('gameOver', (data) => {
    showScreen('winner');
    document.getElementById('winner-message').textContent = `🎉 ${data.winnerName} wins! 🎉`;
    addGameLog(`${data.winnerName} reached 100 and won!`);
    // Trigger confetti
    triggerConfetti();
});

socket.on('gameRestarted', (data) => {
    gameStarted = false;
    boardConfig = data.board;
    showScreen('lobby');
    updateLobby(data.players);
    addLobbyMessage('Game restarted. Waiting to start...');
});

function updateLobby(players) {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `<span style="color: ${player.color};">●</span> ${player.name}`;
        playerList.appendChild(div);
    });
}

function addLobbyMessage(msg) {
    const messages = document.getElementById('lobby-messages');
    const div = document.createElement('div');
    div.textContent = msg;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function addGameLog(msg) {
    const log = document.getElementById('game-log');
    const div = document.createElement('div');
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function createBoard(board) {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';

    const snakeStarts = new Set((board?.snakes || []).map(s => s.start));
    const ladderStarts = new Set((board?.ladders || []).map(l => l.start));

    for (let i = 100; i >= 1; i--) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        if (i % 10 === 0) {
            tile.style.gridColumnStart = 10;
            tile.style.gridRowStart = 11 - Math.floor(i / 10);
        } else {
            tile.style.gridColumnStart = (i % 10);
            tile.style.gridRowStart = 11 - Math.floor((i - 1) / 10) - 1;
        }

        if (snakeStarts.has(i)) {
            const snake = (board.snakes || []).find(s => s.start === i);
            tile.classList.add('snake');
            tile.textContent = `${i} 🐍→${snake.end}`;
        } else if (ladderStarts.has(i)) {
            const ladder = (board.ladders || []).find(l => l.start === i);
            tile.classList.add('ladder');
            tile.textContent = `${i} 🪜→${ladder.end}`;
        } else {
            tile.textContent = i;
        }

        boardElement.appendChild(tile);
    }
}

function updateBoard(players) {
    // Clear previous players
    document.querySelectorAll('.player').forEach(p => p.remove());
    players.forEach(player => {
        const tile = document.querySelector(`.tile:nth-child(${101 - player.position})`);
        if (tile) {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player';
            playerDiv.style.backgroundColor = player.color;
            playerDiv.title = player.name;
            tile.appendChild(playerDiv);
        }
    });
}

function updatePlayers(players) {
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-info';
        div.innerHTML = `<span style="color: ${player.color};">●</span> ${player.name}: ${player.position}`;
        if (player.id === currentPlayer) {
            div.style.fontWeight = 'bold';
            div.style.textDecoration = 'underline';
        }
        playersDiv.appendChild(div);
    });
}

function triggerConfetti() {
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
    }
}
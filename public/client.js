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

    // Create tiles in visual order (top-left to bottom-right)
    for (let row = 10; row >= 1; row--) {
        for (let col = 1; col <= 10; col++) {
            // Calculate position based on row and column
            let position;
            if ((10 - row) % 2 === 0) {
                // Visual odd rows (1,3,5...) go right to left: 100-91, 80-71, etc.
                position = row * 10 - col + 1;
            } else {
                // Visual even rows (2,4,6...) go left to right: 81-90, 61-70, etc.
                position = (row - 1) * 10 + col;
            }

            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.position = position; // Store position for easy lookup

            if (snakeStarts.has(position)) {
                const snake = (board.snakes || []).find(s => s.start === position);
                tile.classList.add('snake');
                tile.textContent = `${position} 🐍→${snake.end}`;
            } else if (ladderStarts.has(position)) {
                const ladder = (board.ladders || []).find(l => l.start === position);
                tile.classList.add('ladder');
                tile.textContent = `${position} 🪜→${ladder.end}`;
            } else {
                tile.textContent = position;
            }

            boardElement.appendChild(tile);
        }
    }
}

function updateBoard(players) {
    // Clear previous players
    document.querySelectorAll('.player').forEach(p => p.remove());
    players.forEach(player => {
        const tile = document.querySelector(`.tile[data-position="${player.position}"]`);
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

socket.on('error', (message) => {
    alert('Error: ' + message);
    console.error('Socket error:', message);
});
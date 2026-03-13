const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const games = {};
const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createGame', (data) => {
        const code = generateCode();
        const board = createBoard();
        const game = {
            code,
            host: socket.id,
            numPlayers: data.numPlayers,
            players: [],
            currentPlayer: 0,
            board,
            started: false
        };
        games[code] = game;
        socket.join(code);
        game.players.push({ id: socket.id, name: data.name, position: 1, color: colors[0] });
        socket.emit('gameCreated', { code, playerId: socket.id, players: game.players, board });
    });

    socket.on('joinGame', (data) => {
        const game = games[data.code];
        if (game && !game.started && game.players.length < game.numPlayers) {
            socket.join(data.code);
            const color = colors[game.players.length];
            game.players.push({ id: socket.id, name: data.name, position: 1, color });
            socket.emit('gameJoined', { code: data.code, playerId: socket.id, players: game.players, board: game.board });
            socket.to(data.code).emit('playerJoined', { players: game.players, playerName: data.name });
        } else {
            socket.emit('error', 'Game not found, full, or already started');
        }
    });

    socket.on('startGame', (data) => {
        const game = games[data.gameCode];
        if (game && game.host === socket.id && game.players.length >= 2) {
            game.started = true;
            io.to(data.gameCode).emit('gameStarted', { players: game.players, currentPlayer: game.players[game.currentPlayer].id, board: game.board });
        }
    });

    socket.on('rollDice', (data) => {
        const game = games[data.gameCode];
        if (game && game.started && game.players[game.currentPlayer].id === socket.id) {
            const roll = Math.floor(Math.random() * 6) + 1;
            const player = game.players[game.currentPlayer];
            player.position += roll;
            if (player.position > 100) player.position = 100;
            // Check snakes and ladders
            const newPos = game.board.map[player.position];
            if (newPos) player.position = newPos;
            io.to(data.gameCode).emit('diceRolled', { roll, player: player.id, playerName: player.name });
            if (player.position >= 100) {
                io.to(data.gameCode).emit('gameOver', { winner: player.id, winnerName: player.name });
            } else {
                game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
                io.to(data.gameCode).emit('updateGame', { players: game.players, currentPlayer: game.players[game.currentPlayer].id, board: game.board });
            }
        }
    });

    socket.on('restartGame', (data) => {
        const game = games[data.gameCode];
        if (game && game.host === socket.id) {
            game.board = createBoard();
            game.players.forEach(p => p.position = 1);
            game.currentPlayer = 0;
            game.started = false;
            io.to(data.gameCode).emit('gameRestarted', { players: game.players, board: game.board });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle player leaving - remove from game, notify others
        for (const code in games) {
            const game = games[code];
            const index = game.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                game.players.splice(index, 1);
                if (game.players.length === 0) {
                    delete games[code];
                } else {
                    if (game.host === socket.id) {
                        game.host = game.players[0].id;
                    }
                    io.to(code).emit('playerLeft', { players: game.players });
                }
                break;
            }
        }
    });
});

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createBoard() {
    const map = {};
    const snakes = [];
    const ladders = [];
    const usedPositions = new Set([1, 100]);

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function addLadder() {
        let start;
        do {
            start = randInt(2, 89);
        } while (usedPositions.has(start));

        let end;
        do {
            end = randInt(start + 5, 99);
        } while (usedPositions.has(end));

        usedPositions.add(start);
        usedPositions.add(end);
        ladders.push({ start, end });
        map[start] = end;
    }

    function addSnake() {
        let start;
        do {
            start = randInt(12, 99);
        } while (usedPositions.has(start));

        let end;
        do {
            end = randInt(2, start - 5);
        } while (usedPositions.has(end));

        usedPositions.add(start);
        usedPositions.add(end);
        snakes.push({ start, end });
        map[start] = end;
    }

    const snakeCount = 9;
    const ladderCount = 9;
    for (let i = 0; i < ladderCount; i++) addLadder();
    for (let i = 0; i < snakeCount; i++) addSnake();

    return { map, snakes, ladders };
}

server.listen(3001, () => {
    console.log('Server running on port 3001');
});
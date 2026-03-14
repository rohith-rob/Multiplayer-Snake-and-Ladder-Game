const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const Game = require('./models/Game');
const Player = require('./models/Player');
const Team = require('./models/Team');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connect to MongoDB
let dbConnected = false;
mongoose.connect('mongodb://localhost:27017/snake-ladder')
.then(() => {
  console.log('Connected to MongoDB');
  dbConnected = true;
}).catch(err => {
  console.error('MongoDB connection error:', err);
  console.log('Running without database - data will not be persisted');
});

app.use(express.static('public'));

const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const games = {}; // Fallback in-memory storage

io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createGame', async (data) => {
        try {
            const code = generateCode();
            const board = createBoard();

            if (dbConnected) {
                // Create or find player
                let player = await Player.findOne({ name: data.name });
                if (!player) {
                    player = new Player({ name: data.name, socketId: socket.id });
                    await player.save();
                } else {
                    player.socketId = socket.id;
                    await player.save();
                }

                // Create game
                const game = new Game({
                    code,
                    host: player._id,
                    numPlayers: data.numPlayers,
                    players: [player._id],
                    board
                });
                await game.save();

                socket.join(code);
                socket.emit('gameCreated', { code, playerId: player._id.toString(), players: [{ id: player._id.toString(), name: player.name, position: 1, color: colors[0] }], board });
            } else {
                // Fallback to in-memory
                const game = {
                    code,
                    host: socket.id,
                    numPlayers: data.numPlayers,
                    players: [{ id: socket.id, name: data.name, position: 1, color: colors[0] }],
                    currentPlayer: 0,
                    board,
                    started: false
                };
                games[code] = game;
                socket.join(code);
                socket.emit('gameCreated', { code, playerId: socket.id, players: game.players, board });
            }
        } catch (error) {
            console.error('Error creating game:', error);
            socket.emit('error', 'Failed to create game');
        }
    });

    socket.on('joinGame', async (data) => {
        try {
            if (dbConnected) {
                const game = await Game.findOne({ code: data.code }).populate('players');
                if (!game || game.status !== 'waiting' || game.players.length >= game.numPlayers) {
                    socket.emit('error', 'Game not found, full, or already started');
                    return;
                }

                // Create or find player
                let player = await Player.findOne({ name: data.name });
                if (!player) {
                    player = new Player({ name: data.name, socketId: socket.id });
                    await player.save();
                } else {
                    player.socketId = socket.id;
                    await player.save();
                }

                game.players.push(player._id);
                await game.save();

                socket.join(data.code);
                const playersData = game.players.map((p, i) => ({
                    id: p._id.toString(),
                    name: p.name,
                    position: 1,
                    color: colors[i]
                }));
                socket.emit('gameJoined', { code: data.code, playerId: player._id.toString(), players: playersData, board: game.board });
                socket.to(data.code).emit('playerJoined', { players: playersData, playerName: data.name });
            } else {
                // Fallback to in-memory
                const game = games[data.code];
                if (!game || game.started || game.players.length >= game.numPlayers) {
                    socket.emit('error', 'Game not found, full, or already started');
                    return;
                }

                game.players.push({ id: socket.id, name: data.name, position: 1, color: colors[game.players.length] });
                socket.join(data.code);
                socket.emit('gameJoined', { code: data.code, playerId: socket.id, players: game.players, board: game.board });
                socket.to(data.code).emit('playerJoined', { players: game.players, playerName: data.name });
            }
        } catch (error) {
            console.error('Error joining game:', error);
            socket.emit('error', 'Failed to join game');
        }
    });

    socket.on('startGame', async (data) => {
        try {
            if (dbConnected) {
                const game = await Game.findOne({ code: data.gameCode }).populate('host players');
                if (game && game.host.socketId === socket.id && game.players.length >= 2) {
                    game.status = 'active';
                    await game.save();
                    io.to(data.gameCode).emit('gameStarted', {
                        players: game.players.map((p, i) => ({
                            id: p._id.toString(),
                            name: p.name,
                            position: 1,
                            color: colors[i]
                        })),
                        currentPlayer: game.players[0]._id.toString(),
                        board: game.board
                    });
                }
            } else {
                // Fallback to in-memory
                const game = games[data.gameCode];
                if (game && game.host === socket.id && game.players.length >= 2) {
                    game.started = true;
                    io.to(data.gameCode).emit('gameStarted', {
                        players: game.players,
                        currentPlayer: game.players[0].id,
                        board: game.board
                    });
                }
            }
        } catch (error) {
            console.error('Error starting game:', error);
        }
    });

    socket.on('rollDice', async (data) => {
        try {
            if (dbConnected) {
                const game = await Game.findOne({ code: data.gameCode }).populate('players');
                const currentPlayerIndex = game.players.findIndex(p => p._id.toString() === data.playerId);
                if (game && game.status === 'active' && currentPlayerIndex !== -1) {
                    const roll = Math.floor(Math.random() * 6) + 1;
                    const player = game.players[currentPlayerIndex];
                    player.position += roll;
                    if (player.position > 100) player.position = 100;

                    const newPos = game.board.map[player.position];
                    if (newPos) player.position = newPos;

                    await game.save();

                    io.to(data.gameCode).emit('diceRolled', { roll, player: player._id.toString(), playerName: player.name });
                    if (player.position >= 100) {
                        game.status = 'finished';
                        game.winner = player._id;
                        game.finishedAt = new Date();
                        await game.save();

                        // Update player stats
                        player.gamesPlayed += 1;
                        player.gamesWon += 1;
                        await player.save();

                        io.to(data.gameCode).emit('gameOver', { winner: player._id.toString(), winnerName: player.name });
                    } else {
                        const nextIndex = (currentPlayerIndex + 1) % game.players.length;
                        io.to(data.gameCode).emit('updateGame', {
                            players: game.players.map((p, i) => ({
                                id: p._id.toString(),
                                name: p.name,
                                position: p.position,
                                color: colors[i]
                            })),
                            currentPlayer: game.players[nextIndex]._id.toString(),
                            board: game.board
                        });
                    }
                }
            } else {
                // Fallback to in-memory
                const game = games[data.gameCode];
                if (game && game.started) {
                    const currentPlayerIndex = game.players.findIndex(p => p.id === data.playerId);
                    if (currentPlayerIndex !== -1) {
                        const roll = Math.floor(Math.random() * 6) + 1;
                        const player = game.players[currentPlayerIndex];
                        player.position += roll;
                        if (player.position > 100) player.position = 100;

                        const newPos = game.board.map[player.position];
                        if (newPos) player.position = newPos;

                        io.to(data.gameCode).emit('diceRolled', { roll, player: player.id, playerName: player.name });
                        if (player.position >= 100) {
                            io.to(data.gameCode).emit('gameOver', { winner: player.id, winnerName: player.name });
                        } else {
                            const nextIndex = (currentPlayerIndex + 1) % game.players.length;
                            io.to(data.gameCode).emit('updateGame', {
                                players: game.players,
                                currentPlayer: game.players[nextIndex].id,
                                board: game.board
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error rolling dice:', error);
        }
    });

    socket.on('restartGame', async (data) => {
        try {
            if (dbConnected) {
                const game = await Game.findOne({ code: data.gameCode }).populate('host players');
                if (game && game.host.socketId === socket.id) {
                    game.board = createBoard();
                    game.players.forEach(p => p.position = 1);
                    game.status = 'waiting';
                    game.winner = null;
                    game.finishedAt = null;
                    await game.save();
                    io.to(data.gameCode).emit('gameRestarted', {
                        players: game.players.map((p, i) => ({
                            id: p._id.toString(),
                            name: p.name,
                            position: 1,
                            color: colors[i]
                        })),
                        board: game.board
                    });
                }
            } else {
                // Fallback to in-memory
                const game = games[data.gameCode];
                if (game && game.host === socket.id) {
                    game.board = createBoard();
                    game.players.forEach(p => p.position = 1);
                    game.started = false;
                    io.to(data.gameCode).emit('gameRestarted', {
                        players: game.players.map(p => ({ ...p, position: 1 })),
                        board: game.board
                    });
                }
            }
        } catch (error) {
            console.error('Error restarting game:', error);
        }
    });

    socket.on('disconnect', async () => {
        try {
            console.log('User disconnected:', socket.id);
            // Update player socketId
            await Player.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
        } catch (error) {
            console.error('Error on disconnect:', error);
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
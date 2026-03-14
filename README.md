# Multiplayer Snake and Ladder Game

A colorful, real-time multiplayer Snake and Ladder web game built with Node.js, Express, and Socket.io.

## Features

- **Host or Join Games**: Create a game with a unique code or join existing ones
- **Player Names**: Enter your name when hosting or joining
- **Game Lobby**: Wait for players to join, see the player list
- **Random Board Layout**: Each game has a unique, randomized snake and ladder setup
- **Real-time Multiplayer**: Play with 2-6 players in real-time
- **Turn-based Gameplay**: Take turns rolling the dice
- **Colorful UI**: Vibrant design with animations and effects
- **Winner Celebration**: Confetti animation when someone wins
- **Restart Option**: Play again with the same group
- **Database Integration**: Optional persistent player stats and game history with MongoDB (game works without it)

## Database Features (Optional)

- **Player Profiles**: Store player names, games played, and wins
- **Game History**: Save completed games with winners and timestamps
- **Team Support**: Future team-based gameplay structure

*Note: All features work without MongoDB - data is stored in memory during gameplay.*

## How to Play

1. **Host a Game**: Click "Host Game", enter your name, select number of players, and create the game. Share the code with friends.
2. **Join a Game**: Click "Join Game", enter your name and the game code.
3. **Lobby**: Wait for all players to join. The host can start the game.
4. **Gameplay**: Take turns rolling the dice (1-6). Move your token on the board. Land on snakes to go down, ladders to go up.
5. **Win**: First to reach tile 100 wins! Celebrate with confetti.
6. **Play Again**: Host can restart for another round with a new board.

## Prerequisites

- Node.js
- MongoDB (optional - game works without it, but data won't be persisted)

## Installation

1. Install dependencies:
   ```
   npm install
   ```

2. (Optional) Start MongoDB service if you want persistent data:
   ```
   mongod
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open your browser and go to `http://localhost:3001`

## Technologies Used

- HTML, CSS, JavaScript
- Node.js
- Express
- Socket.io
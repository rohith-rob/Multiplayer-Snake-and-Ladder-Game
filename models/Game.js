const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  numPlayers: { type: Number, required: true, min: 2, max: 6 },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  board: {
    map: { type: Object },
    snakes: [{ start: Number, end: Number }],
    ladders: [{ start: Number, end: Number }]
  },
  status: { type: String, enum: ['waiting', 'active', 'finished'], default: 'waiting' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  createdAt: { type: Date, default: Date.now },
  finishedAt: { type: Date }
});

module.exports = mongoose.model('Game', gameSchema);
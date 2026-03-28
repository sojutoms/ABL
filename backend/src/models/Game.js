const mongoose = require('mongoose');

const quarterScoreSchema = new mongoose.Schema(
  {
    q1: { type: Number, default: 0 },
    q2: { type: Number, default: 0 },
    q3: { type: Number, default: 0 },
    q4: { type: Number, default: 0 },
    ot: { type: Number, default: 0 },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    scheduledDate: { type: Date, required: true },
    venue: { type: String, default: '' },

    // Status: 'scheduled' | 'live' | 'final'
    status: {
      type: String,
      enum: ['scheduled', 'live', 'final'],
      default: 'scheduled',
    },

    // Live game state
    currentQuarter: { type: Number, default: 1, min: 1, max: 5 }, // 5 = OT
    gameClock: { type: String, default: '10:00' }, // MM:SS format
    isOvertime: { type: Boolean, default: false },

    // Scores
    homeScore: { type: Number, default: 0 },
    awayScore: { type: Number, default: 0 },
    homeQuarterScores: { type: quarterScoreSchema, default: () => ({}) },
    awayQuarterScores: { type: quarterScoreSchema, default: () => ({}) },

    // Team fouls per quarter
    homeTeamFouls: { type: Number, default: 0 },
    awayTeamFouls: { type: Number, default: 0 },

    // Season/round info
    season: { type: String, default: '2025' },
    gameNumber: { type: Number, default: 0 },
    round: { type: String, default: 'Regular Season' },

    // Broadcast / notes
    broadcastChannel: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Index for quick live game queries
gameSchema.index({ status: 1, scheduledDate: -1 });

module.exports = mongoose.model('Game', gameSchema);
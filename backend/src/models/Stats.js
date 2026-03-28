const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema(
  {
    game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

    // Playing time
    minutesPlayed: { type: Number, default: 0 },
    didNotPlay: { type: Boolean, default: false },
    isStarter: { type: Boolean, default: false },

    // Scoring
    points: { type: Number, default: 0 },

    // Field Goals
    fgMade: { type: Number, default: 0 },
    fgAttempts: { type: Number, default: 0 },

    // 3-Pointers
    threePtMade: { type: Number, default: 0 },
    threePtAttempts: { type: Number, default: 0 },

    // Free Throws
    ftMade: { type: Number, default: 0 },
    ftAttempts: { type: Number, default: 0 },

    // Rebounds
    offRebounds: { type: Number, default: 0 },
    defRebounds: { type: Number, default: 0 },
    totalRebounds: { type: Number, default: 0 },

    // Other stats
    assists: { type: Number, default: 0 },
    steals: { type: Number, default: 0 },
    blocks: { type: Number, default: 0 },
    turnovers: { type: Number, default: 0 },
    personalFouls: { type: Number, default: 0 },
    plusMinus: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Virtual: FG%
statsSchema.virtual('fgPct').get(function () {
  if (this.fgAttempts === 0) return 0;
  return parseFloat((this.fgMade / this.fgAttempts).toFixed(3));
});

// Virtual: 3P%
statsSchema.virtual('threePtPct').get(function () {
  if (this.threePtAttempts === 0) return 0;
  return parseFloat((this.threePtMade / this.threePtAttempts).toFixed(3));
});

// Virtual: FT%
statsSchema.virtual('ftPct').get(function () {
  if (this.ftAttempts === 0) return 0;
  return parseFloat((this.ftMade / this.ftAttempts).toFixed(3));
});

statsSchema.set('toJSON', { virtuals: true });
statsSchema.set('toObject', { virtuals: true });

// Unique: one stat line per player per game
statsSchema.index({ game: 1, player: 1 }, { unique: true });
statsSchema.index({ game: 1, team: 1 });
statsSchema.index({ player: 1 });

module.exports = mongoose.model('Stats', statsSchema);
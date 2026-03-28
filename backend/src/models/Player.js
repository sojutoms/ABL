const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    jerseyNumber: { type: Number, required: true },
    position: {
      type: String,
      enum: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'G/F', 'F/C'],
      required: true,
    },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    height: { type: String, default: '' },   // e.g. "6'2"
    weight: { type: Number, default: 0 },    // lbs
    age: { type: Number, default: 0 },
    photo: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    // Season averages (updated after each game)
    gamesPlayed: { type: Number, default: 0 },
    avgPoints: { type: Number, default: 0 },
    avgRebounds: { type: Number, default: 0 },
    avgAssists: { type: Number, default: 0 },
    avgSteals: { type: Number, default: 0 },
    avgBlocks: { type: Number, default: 0 },
    avgTurnovers: { type: Number, default: 0 },
    avgMinutes: { type: Number, default: 0 },
    avgFgPct: { type: Number, default: 0 },
    avg3pPct: { type: Number, default: 0 },
    avgFtPct: { type: Number, default: 0 },
  },
  { timestamps: true }
);

playerSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

playerSchema.set('toJSON', { virtuals: true });
playerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Player', playerSchema);
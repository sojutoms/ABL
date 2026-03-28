const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    abbreviation: { type: String, required: true, uppercase: true, trim: true, maxlength: 5 },
    city: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    primaryColor: { type: String, default: '#000000' },
    secondaryColor: { type: String, default: '#FFFFFF' },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    homeWins: { type: Number, default: 0 },
    homeLosses: { type: Number, default: 0 },
    awayWins: { type: Number, default: 0 },
    awayLosses: { type: Number, default: 0 },
    pointsFor: { type: Number, default: 0 },
    pointsAgainst: { type: Number, default: 0 },
    streak: { type: String, default: 'W0' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual: win percentage
teamSchema.virtual('winPct').get(function () {
  const total = this.wins + this.losses;
  if (total === 0) return 0;
  return parseFloat((this.wins / total).toFixed(3));
});

// Virtual: games behind (needs to be calculated at query level)
teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);
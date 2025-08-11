import mongoose from 'mongoose';

const streakRestoreSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  habit: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', index: true, required: true },
  lostAt: { type: String }, // YYYY-MM-DD when break occurred
  previousEnd: { type: String },
  restoredAt: { type: Date },
  paymentIntentId: { type: String, index: true },
  priceId: { type: String },
  priceCents: { type: Number, default: 99 },
  currency: { type: String, default: 'USD' },
}, { versionKey: false, timestamps: true });

export default mongoose.model('StreakRestore', streakRestoreSchema);


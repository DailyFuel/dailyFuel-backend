import mongoose from 'mongoose';

const coachPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  generatedAt: { type: Date, default: Date.now, index: true },
  habitsHash: { type: String, index: true },
  habits: { type: Array, default: [] },
  plan: { type: Object },
}, { versionKey: false });

coachPlanSchema.index({ user: 1, generatedAt: -1 });
coachPlanSchema.index({ user: 1, habitsHash: 1 });

export default mongoose.model('CoachPlan', coachPlanSchema);


import mongoose from 'mongoose';

const deepInsightSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  generatedAt: { type: Date, default: Date.now, index: true },
  windowStart: { type: String },
  windowEnd: { type: String },
  features: { type: Object },
  summary: { type: String },
  promptVersion: { type: String },
  llm: {
    recommendations: { type: [String], default: [] },
    rationale: { type: [String], default: [] },
    tips: { type: [String], default: [] },
  },
}, { versionKey: false });

deepInsightSchema.index({ user: 1, generatedAt: -1 });
deepInsightSchema.index({ user: 1, windowEnd: -1 });

export default mongoose.model('DeepInsight', deepInsightSchema);


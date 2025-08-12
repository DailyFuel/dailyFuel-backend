import mongoose from 'mongoose';

const llmUsageSchema = new mongoose.Schema({
  model: String,
  promptTokens: Number,
  completionTokens: Number,
  totalTokens: Number,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  context: String, // e.g., 'deep_insight', 'coach_plan'
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

export default mongoose.model('LlmUsage', llmUsageSchema);


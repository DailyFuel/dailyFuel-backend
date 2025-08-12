import mongoose from 'mongoose';

const aiLockSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  expiresAt: { type: Date },
}, { versionKey: false });

// TTL index to auto-clean locks
aiLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AiLock', aiLockSchema);


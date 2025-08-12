import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    context: {
      appVersion: { type: String },
      device: { type: String },
      platform: { type: String },
      locale: { type: String },
      path: { type: String },
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

eventSchema.index({ user: 1, name: 1, timestamp: 1 });

export default mongoose.model("Event", eventSchema);

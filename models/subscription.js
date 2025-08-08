import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true 
},
  plan: { 
    type: String, 
    enum: ["free", "pro"], 
    default: "free" 
},
  status: { 
    type: String, 
    enum: ["active", "cancelled", "expired"], 
    default: "active" 
},
  // Stripe linkage
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  stripePriceId: { type: String },
  stripeStatus: { type: String },
  interval: { type: String, enum: ["month", "year", null], default: null },
  cancel_at_period_end: { type: Boolean, default: false },
  current_period_start: { type: Date },
  current_period_end: { type: Date },
  start_date: { 
    type: Date, 
    default: Date.now 
},
  end_date: { 
    type: Date 
},
  renewal: { 
    type: Boolean, default: true 
}
});

export default mongoose.model("Subscription", subscriptionSchema);

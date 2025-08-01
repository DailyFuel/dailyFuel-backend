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

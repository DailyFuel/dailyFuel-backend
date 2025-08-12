import mongoose from "mongoose";

const affiliateSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true 
},
  code: { 
    type: String, 
    required: true, 
    unique: true 
},
  earnings: { 
    type: Number, 
    default: 0 
},
  total_referrals: { 
    type: Number, 
    default: 0 
}
});

export default mongoose.model("Affiliate", affiliateSchema);

import mongoose from "mongoose";

const referralSchema = new mongoose.Schema({
  referred_user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true 
},
  referred_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
},
  affiliate_code: { 
    type: String 
},
  date: { 
    type: Date, 
    default: Date.now 
},
  conversion: { 
    type: Boolean, 
    default: false 
} // Whether they subscribed
});

export default mongoose.model("Referral", referralSchema);

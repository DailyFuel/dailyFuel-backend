import mongoose, { Schema, model } from "mongoose";

const userSchema = new Schema({
  email: {
    type: String,
    unique: true,
    required: [true, 'Please enter a valid email address'],
    minLength: 3,
    maxLength: 100,
    match: [/.+@.+\..+/, 'Please enter a valid email address.']
  },
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters'],
    required: [true, 'Please enter a valid password'],
    validate: {
      validator: function (v) {
        return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(v)
      },
      message: props => 'Password must include upper/lowercase letter and a number'
    }
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'premium'],
    default: "free"
  },
  affiliateCode: {
    type: String, // Public code like "TYSON25"
    unique: true,
    sparse: true
  },
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralDate: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const User = model('User', userSchema);

export default User;

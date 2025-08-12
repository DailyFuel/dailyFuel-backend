import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stripeInvoiceId: { type: String, index: true },
  stripePaymentIntentId: { type: String, index: true },
  amount: { type: Number, required: true }, // in cents
  currency: { type: String, default: 'usd' },
  status: { type: String },
  hostedInvoiceUrl: { type: String },
  invoicePdf: { type: String },
  lines: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Receipt', receiptSchema);


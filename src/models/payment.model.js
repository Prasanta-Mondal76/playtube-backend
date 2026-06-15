import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true, // in paise (100 paise = ₹1)
    },
    planLabel: {
      type: String,
      required: true, // e.g. "5 hours", "15 days"
    },
    durationMs: {
      type: Number,
      required: true, // duration in milliseconds
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
    expiresAt: {
      type: Date,
      default: null, // set after payment verified
    },
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", paymentSchema);
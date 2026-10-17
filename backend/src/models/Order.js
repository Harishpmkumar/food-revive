import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    food: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (items) => items.length > 0,
    },
    subtotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "paid",
        "cancelled",
        "expired",
        "completed",
      ],
      default: "pending_payment",
      index: true,
    },
    reservationExpiresAt: { type: Date, required: true, index: true },
    paymentProvider: {
      type: String,
      enum: ["razorpay"],
      default: undefined,
    },
    paymentOrderId: { type: String, default: undefined },
    paymentId: { type: String, default: undefined },
    paidAt: { type: Date, default: undefined },
    pickupCodeHash: { type: String, default: undefined, select: false },
    pickedUpAt: { type: Date, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ vendor: 1, createdAt: -1 });

export default mongoose.model("Order", orderSchema);

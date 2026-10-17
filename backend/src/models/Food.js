import mongoose from "mongoose";

const foodSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "meals",
        "bakery",
        "fruits",
        "vegetables",
        "dairy",
        "snacks",
        "beverages",
        "other",
      ],
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0.01,
    },
    quantityAvailable: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (images) => images.length <= 5,
        message: "A food listing can have at most 5 images",
      },
    },
    pickupAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    pickupStartAt: {
      type: Date,
      required: true,
    },
    pickupEndAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["available", "sold_out", "expired"],
      default: "available",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

foodSchema.index({ status: 1, category: 1, createdAt: -1 });
foodSchema.index({ title: "text", description: "text" });

const Food = mongoose.model("Food", foodSchema);

export default Food;

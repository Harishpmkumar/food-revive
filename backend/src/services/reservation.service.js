import mongoose from "mongoose";
import Order from "../models/Order.js";
import Food from "../models/Food.js";

export const releaseExpiredReservations = async () => {
  const now = new Date();

  const expiredOrders = await Order.find({
    status: "pending_payment",
    reservationExpiresAt: { $lte: now },
  }).select("_id");

  for (const candidate of expiredOrders) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const order = await Order.findOneAndUpdate(
          {
            _id: candidate._id,
            status: "pending_payment",
            reservationExpiresAt: { $lte: new Date() },
          },
          { $set: { status: "expired" } },
          { new: true, session }
        );

        if (!order) return;

        for (const item of order.items) {
          const food = await Food.findOne({
            _id: item.food,
            expiresAt: { $gt: new Date() },
          }).session(session);

          if (!food) continue;

          const nextQuantity = food.quantityAvailable + item.quantity;

          await Food.updateOne(
            { _id: food._id },
            {
              $set: {
                quantityAvailable: nextQuantity,
                status: "available",
              },
            },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }
  }
};

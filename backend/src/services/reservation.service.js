import mongoose from "mongoose";
import Order from "../models/Order.js";
import Food from "../models/Food.js";

export const releaseExpiredReservations = async () => {
  const now = new Date();

  const expiredOrders = await Order.find({
    status: "pending_payment",
    reservationExpiresAt: { $lte: now },
  })
    .select("_id")
    .lean();

  let releasedCount = 0;

  for (const candidate of expiredOrders) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Claim the expired reservation only once.
        const order = await Order.findOneAndUpdate(
          {
            _id: candidate._id,
            status: "pending_payment",
            reservationExpiresAt: { $lte: new Date() },
          },
          {
            $set: { status: "expired" },
          },
          {
            new: true,
            session,
          },
        );

        // Another request may already have processed this order.
        if (!order) return;

        for (const item of order.items) {
          const food = await Food.findById(item.food).session(session);

          // The food listing might have been deleted.
          if (!food) continue;

          const listingHasExpired = food.expiresAt <= new Date();

          await Food.updateOne(
            { _id: food._id },
            {
              $inc: {
                quantityAvailable: item.quantity,
              },
              $set: {
                // Never reactivate a listing past its expiry time.
                status: listingHasExpired ? "expired" : "available",
              },
            },
            { session },
          );
        }

        releasedCount += 1;
      });
    } finally {
      await session.endSession();
    }
  }

  return {
    checkedCount: expiredOrders.length,
    releasedCount,
  };
};

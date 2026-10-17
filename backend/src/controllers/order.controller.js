import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Food from "../models/Food.js";
import Order from "../models/Order.js";
import { releaseExpiredReservations } from "../services/reservation.service.js";

const RESERVATION_MINUTES = 10;

export const checkout = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    await releaseExpiredReservations();

    let createdOrder;

    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ user: req.user._id }).session(session);

      if (!cart || cart.items.length === 0) {
        const error = new Error("Your cart is empty");
        error.statusCode = 400;
        throw error;
      }

      const foodIds = cart.items.map((item) => item.food);
      const foods = await Food.find({
        _id: { $in: foodIds },
      }).session(session);

      const foodById = new Map(
        foods.map((food) => [food._id.toString(), food]),
      );

      const orderItems = [];
      let vendorId = null;
      let subtotal = 0;

      for (const cartItem of cart.items) {
        const food = foodById.get(cartItem.food.toString());

        if (
          !food ||
          food.status !== "available" ||
          food.expiresAt <= new Date() ||
          food.quantityAvailable < cartItem.quantity
        ) {
          const error = new Error(
            "One or more cart items are no longer available in the requested quantity",
          );
          error.statusCode = 409;
          throw error;
        }

        if (!vendorId) {
          vendorId = food.vendor.toString();
        } else if (vendorId !== food.vendor.toString()) {
          const error = new Error(
            "An order can contain food from only one vendor",
          );
          error.statusCode = 400;
          throw error;
        }

        orderItems.push({
          food: food._id,
          title: food.title,
          quantity: cartItem.quantity,
          unitPrice: food.price,
          originalPrice: food.originalPrice,
        });

        subtotal += food.price * cartItem.quantity;
      }

      // Conditional updates make the stock reservation atomic.
      for (const item of orderItems) {
        const result = await Food.updateOne(
          {
            _id: item.food,
            status: "available",
            expiresAt: { $gt: new Date() },
            quantityAvailable: { $gte: item.quantity },
          },
          [
            {
              $set: {
                quantityAvailable: {
                  $subtract: ["$quantityAvailable", item.quantity],
                },
                status: {
                  $cond: [
                    {
                      $eq: [
                        { $subtract: ["$quantityAvailable", item.quantity] },
                        0,
                      ],
                    },
                    "sold_out",
                    "available",
                  ],
                },
              },
            },
          ],
          { session, updatePipeline: true },
        );

        if (result.modifiedCount !== 1) {
          const error = new Error(
            "Stock changed during checkout. Please review your cart and try again.",
          );
          error.statusCode = 409;
          throw error;
        }
      }

      const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

      const orders = await Order.create(
        [
          {
            buyer: req.user._id,
            vendor: vendorId,
            items: orderItems,
            subtotal: Number(subtotal.toFixed(2)),
            status: "pending_payment",
            reservationExpiresAt: expiresAt,
          },
        ],
        { session },
      );

      createdOrder = orders[0];

      cart.items = [];
      await cart.save({ session });
    });

    return res.status(201).json({
      success: true,
      message: "Inventory reserved. Complete payment within 10 minutes.",
      data: {
        order: {
          id: createdOrder._id,
          items: createdOrder.items,
          subtotal: createdOrder.subtotal,
          status: createdOrder.status,
          reservationExpiresAt: createdOrder.reservationExpiresAt,
        },
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    await releaseExpiredReservations();

    const orders = await Order.find({ buyer: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Food from "../models/Food.js";

const FOOD_FIELDS =
  "vendor title price originalPrice quantityAvailable images expiresAt status";

async function sendCart(res, userId, message = "Cart retrieved successfully") {
  const cart = await Cart.findOne({ user: userId }).populate(
    "items.food",
    FOOD_FIELDS
  );

  const items = (cart?.items ?? [])
    .filter((item) => item.food)
    .map((item) => ({
      food: item.food,
      quantity: item.quantity,
      lineTotal: item.food.price * item.quantity,
    }));

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);

  return res.status(200).json({
    success: true,
    message,
    data: { items, itemCount, subtotal },
  });
}

function isValidQuantity(quantity) {
  return Number.isInteger(quantity) && quantity >= 1;
}

async function getAvailableFood(foodId) {
  if (!mongoose.isValidObjectId(foodId)) {
    const error = new Error("Invalid food listing ID");
    error.statusCode = 400;
    throw error;
  }

  const food = await Food.findById(foodId);

  if (
    !food ||
    food.status !== "available" ||
    food.expiresAt <= new Date() ||
    food.quantityAvailable < 1
  ) {
    const error = new Error("This food listing is not available");
    error.statusCode = 400;
    throw error;
  }

  return food;
}

export async function getCart(req, res, next) {
  try {
    return await sendCart(res, req.user._id);
  } catch (error) {
    next(error);
  }
}

export async function addCartItem(req, res, next) {
  try {
    const { foodId, quantity } = req.body;

    if (!isValidQuantity(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive whole number",
      });
    }

    const food = await getAvailableFood(foodId);

    if (quantity > food.quantityAvailable) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock",
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      try {
        // Create an empty cart, then add the item exactly once below.
        cart = await Cart.create({
          user: req.user._id,
          items: [],
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        cart = await Cart.findOne({ user: req.user._id });
      }
    }

    if (!cart) {
      throw new Error("Unable to create or retrieve cart");
    }

    const existingVendorId = cart.items.length
      ? (await Food.findById(cart.items[0].food))?.vendor?.toString()
      : null;

    if (existingVendorId && existingVendorId !== food.vendor.toString()) {
      return res.status(400).json({
        success: false,
        message: "Your cart can contain food from only one vendor",
      });
    }

    const existingItem = cart.items.find(
      (item) => item.food.toString() === food._id.toString()
    );

    const newQuantity = (existingItem?.quantity ?? 0) + quantity;

    if (newQuantity > food.quantityAvailable) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock",
      });
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ food: food._id, quantity });
    }

    await cart.save();

    return await sendCart(res, req.user._id, "Food added to cart");
  } catch (error) {
    next(error);
  }
}

export async function updateCartItem(req, res, next) {
  try {
    const { foodId } = req.params;
    const { quantity } = req.body;

    if (!isValidQuantity(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive whole number",
      });
    }

    const food = await getAvailableFood(foodId);

    if (quantity > food.quantityAvailable) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock",
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.find(
      (entry) => entry.food.toString() === foodId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Food item not found in cart",
      });
    }

    item.quantity = quantity;
    await cart.save();

    return await sendCart(res, req.user._id, "Cart updated successfully");
  } catch (error) {
    next(error);
  }
}

export async function removeCartItem(req, res, next) {
  try {
    const { foodId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter(
      (item) => item.food.toString() !== foodId
    );

    await cart.save();

    return await sendCart(res, req.user._id, "Food removed from cart");
  } catch (error) {
    next(error);
  }
}

export async function clearCart(req, res, next) {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return await sendCart(res, req.user._id, "Cart cleared successfully");
  } catch (error) {
    next(error);
  }
}

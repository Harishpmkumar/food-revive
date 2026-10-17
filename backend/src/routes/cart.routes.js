import { Router } from "express";
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize("customer"));
router.get("/", getCart);
router.post("/items", addCartItem);
router.patch("/items/:foodId", updateCartItem);
router.delete("/items/:foodId", removeCartItem);
router.delete("/", clearCart);

export default router;

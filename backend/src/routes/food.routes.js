import { Router } from "express";
import {
  createFood,
  listFood,
  getFoodById,
  updateFood,
  deleteFood,
} from "../controllers/food.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// Public customer browsing
router.get("/", listFood);
router.get("/:id", getFoodById);

// Vendor management
router.post("/", authenticate, authorize("vendor"), createFood);
router.patch("/:id", authenticate, authorize("vendor"), updateFood);
router.delete("/:id", authenticate, authorize("vendor"), deleteFood);

export default router;

import { Router } from "express";
import { checkout, getMyOrders } from "../controllers/order.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize("customer"));
router.post("/checkout", checkout);
router.get("/my", getMyOrders);

export default router;

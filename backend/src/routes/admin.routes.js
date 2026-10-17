import { Router } from "express";
import {
  listVendors,
  updateVendorStatus,
} from "../controllers/admin.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/vendors", listVendors);
router.patch("/vendors/:id/status", updateVendorStatus);

export default router;

import mongoose from "mongoose";
import User from "../models/User.js";

export const listVendors = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, approved or rejected",
      });
    }

    const vendors = await User.find({
      role: "vendor",
      vendorStatus: status,
    })
      .select("name email vendorStatus isActive createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: { vendors, count: vendors.length },
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const vendor = await User.findOneAndUpdate(
      { _id: id, role: "vendor" },
      { $set: { vendorStatus: status } },
      { new: true, runValidators: true }
    ).select("name email vendorStatus isActive createdAt");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    return res.json({
      success: true,
      message: `Vendor ${status} successfully`,
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

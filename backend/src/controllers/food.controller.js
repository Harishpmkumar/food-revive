import mongoose from "mongoose";
import Food from "../models/Food.js";

const categories = [
  "meals",
  "bakery",
  "fruits",
  "vegetables",
  "dairy",
  "snacks",
  "beverages",
  "other",
];

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateListingDates = (data) => {
  const start = new Date(data.pickupStartAt);
  const end = new Date(data.pickupEndAt);
  const expiry = new Date(data.expiresAt);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    Number.isNaN(expiry.getTime())
  ) {
    return "Provide valid pickup and expiry dates";
  }

  if (start >= end) {
    return "Pickup end time must be after pickup start time";
  }

  if (expiry <= new Date()) {
    return "Expiry time must be in the future";
  }

  if (end > expiry) {
    return "Pickup must finish before the food expires";
  }

  return null;
};

const allowedFields = [
  "title",
  "description",
  "category",
  "price",
  "originalPrice",
  "quantityAvailable",
  "images",
  "pickupAddress",
  "pickupStartAt",
  "pickupEndAt",
  "expiresAt",
];

const getListingData = (body) =>
  Object.fromEntries(
    allowedFields
      .filter((field) =>
        Object.prototype.hasOwnProperty.call(body, field)
      )
      .map((field) => [field, body[field]])
  );

const validateListingData = (data, isUpdate = false) => {
  if (!isUpdate || data.category !== undefined) {
    if (data.category !== undefined && !categories.includes(data.category)) {
      return "Invalid food category";
    }
  }

  if (
    data.quantityAvailable !== undefined &&
    (!Number.isInteger(data.quantityAvailable) || data.quantityAvailable < 0)
  ) {
    return "Available quantity must be a non-negative whole number";
  }

  for (const field of ["price", "originalPrice"]) {
    if (
      data[field] !== undefined &&
      (!Number.isFinite(data[field]) || data[field] <= 0)
    ) {
      return `${field} must be a positive number`;
    }
  }

  if (
    data.images !== undefined &&
    (!Array.isArray(data.images) ||
      data.images.length > 5 ||
      data.images.some(
        (url) =>
          typeof url !== "string" ||
          !/^https?:\/\/\S+$/i.test(url.trim())
      ))
  ) {
    return "Images must be an array of up to 5 valid HTTP(S) URLs";
  }

  return null;
};

const populateVendor = {
  path: "vendor",
  select: "name",
};

export const createFood = async (req, res, next) => {
  try {
    if (
      req.user.role !== "vendor" ||
      req.user.vendorStatus !== "approved"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only approved vendors can publish food listings",
      });
    }

    const data = getListingData(req.body ?? {});
    const validationError = validateListingData(data);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const dateError = validateListingDates(data);

    if (dateError) {
      return res.status(400).json({
        success: false,
        message: dateError,
      });
    }

    if (
      data.originalPrice !== undefined &&
      data.price !== undefined &&
      data.price > data.originalPrice
    ) {
      return res.status(400).json({
        success: false,
        message: "Discounted price cannot exceed original price",
      });
    }

    const food = await Food.create({
      ...data,
      vendor: req.user._id,
      status: data.quantityAvailable > 0 ? "available" : "sold_out",
    });

    await food.populate(populateVendor);

    return res.status(201).json({
      success: true,
      message: "Food listing created successfully",
      data: { food },
    });
  } catch (error) {
    next(error);
  }
};

export const listFood = async (req, res, next) => {
  try {
    const page = Number.parseInt(req.query.page ?? "1", 10);
    const limit = Number.parseInt(req.query.limit ?? "12", 10);
    const { search, category, minPrice, maxPrice, sort } = req.query;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50",
      });
    }

    if (category && !categories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid food category",
      });
    }

    const priceFilter = {};

    if (minPrice !== undefined) {
      priceFilter.$gte = Number(minPrice);
    }

    if (maxPrice !== undefined) {
      priceFilter.$lte = Number(maxPrice);
    }

    if (
      Object.values(priceFilter).some((value) => !Number.isFinite(value)) ||
      (priceFilter.$gte !== undefined && priceFilter.$gte < 0) ||
      (priceFilter.$lte !== undefined && priceFilter.$lte < 0) ||
      (priceFilter.$gte !== undefined &&
        priceFilter.$lte !== undefined &&
        priceFilter.$gte > priceFilter.$lte)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price range",
      });
    }

    const filter = {
      status: "available",
      quantityAvailable: { $gt: 0 },
      expiresAt: { $gt: new Date() },
    };

    if (category) filter.category = category;
    if (Object.keys(priceFilter).length) filter.price = priceFilter;

    if (search?.trim()) {
      if (search.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Search must be 100 characters or fewer",
        });
      }

      const pattern = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [
        { title: pattern },
        { description: pattern },
      ];
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { price: 1, createdAt: -1 },
      price_desc: { price: -1, createdAt: -1 },
    };

    const sortBy = sort || "newest";

    if (!sortOptions[sortBy]) {
      return res.status(400).json({
        success: false,
        message: "Sort must be newest, price_asc or price_desc",
      });
    }

    const [foods, total] = await Promise.all([
      Food.find(filter)
        .populate(populateVendor)
        .sort(sortOptions[sortBy])
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Food.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        foods,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getFoodById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid food listing ID",
      });
    }

    const food = await Food.findOne({
      _id: req.params.id,
      status: "available",
      quantityAvailable: { $gt: 0 },
      expiresAt: { $gt: new Date() },
    }).populate(populateVendor);

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Available food listing not found",
      });
    }

    return res.json({
      success: true,
      data: { food },
    });
  } catch (error) {
    next(error);
  }
};

export const updateFood = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid food listing ID",
      });
    }

    if (
      req.user.role !== "vendor" ||
      req.user.vendorStatus !== "approved"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only approved vendors can update listings",
      });
    }

    const data = getListingData(req.body ?? {});

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one supported field to update",
      });
    }

    const validationError = validateListingData(data, true);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const food = await Food.findOne({
      _id: req.params.id,
      vendor: req.user._id,
    });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food listing not found for this vendor",
      });
    }

    if (
      data.price !== undefined &&
      data.originalPrice === undefined &&
      data.price > food.originalPrice
    ) {
      return res.status(400).json({
        success: false,
        message: "Discounted price cannot exceed original price",
      });
    }

    if (
      data.originalPrice !== undefined &&
      data.price === undefined &&
      food.price > data.originalPrice
    ) {
      return res.status(400).json({
        success: false,
        message: "Discounted price cannot exceed original price",
      });
    }

    const merged = {
      pickupStartAt: data.pickupStartAt ?? food.pickupStartAt,
      pickupEndAt: data.pickupEndAt ?? food.pickupEndAt,
      expiresAt: data.expiresAt ?? food.expiresAt,
    };

    if (
      ["pickupStartAt", "pickupEndAt", "expiresAt"].some(
        (field) => data[field] !== undefined
      )
    ) {
      const dateError = validateListingDates(merged);

      if (dateError) {
        return res.status(400).json({
          success: false,
          message: dateError,
        });
      }
    }

    for (const [key, value] of Object.entries(data)) {
      food.set(key, value);
    }

    if (food.quantityAvailable === 0) {
      food.status = "sold_out";
    } else if (food.status === "sold_out") {
      food.status = "available";
    }

    await food.save();
    await food.populate(populateVendor);

    return res.json({
      success: true,
      message: "Food listing updated successfully",
      data: { food },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFood = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid food listing ID",
      });
    }

    const food = await Food.findOneAndDelete({
      _id: req.params.id,
      vendor: req.user._id,
    });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food listing not found for this vendor",
      });
    }

    return res.json({
      success: true,
      message: "Food listing deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

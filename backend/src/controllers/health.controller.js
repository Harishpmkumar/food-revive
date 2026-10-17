export function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: "Food Revive API is healthy",
    data: {
      service: "food-revive-backend",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    },
  });
}

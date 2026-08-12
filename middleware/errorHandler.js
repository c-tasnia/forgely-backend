export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode !== 200 ? res.statusCode : err.statusCode || 500;

  // Prisma unique constraint violation
  if (err.code === "P2002") {
    const field = Array.isArray(err.meta?.target) ? err.meta.target[0] : err.meta?.target || "field";
    return res.status(409).json({ message: `${field} already in use` });
  }

  // Prisma record not found (e.g. update/delete on a missing row)
  if (err.code === "P2025") {
    return res.status(404).json({ message: "Record not found" });
  }

  // Prisma foreign key constraint failure
  if (err.code === "P2003") {
    return res.status(400).json({ message: "Related record does not exist" });
  }

  res.status(statusCode === 200 ? 500 : statusCode).json({
    message: err.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

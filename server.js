import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`ProjectForge API running on port ${PORT}`));

const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

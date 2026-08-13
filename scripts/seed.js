import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

dotenv.config();

const run = async () => {
  const email = "demo@projectforge.dev";
  let demoUser = await prisma.user.findUnique({ where: { email } });
  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        name: "Demo User",
        email,
        password: await bcrypt.hash("demo1234", 10),
        bio: "Exploring ProjectForge",
        skills: ["React", "Node.js"],
      },
    });
    console.log("Created demo user:", email, "/ demo1234");
  }

  const adminEmail = "admin@projectforge.dev";
  const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        name: "Platform Admin",
        email: adminEmail,
        password: await bcrypt.hash("admin1234", 10),
        role: "admin",
      },
    });
    console.log("Created admin user:", adminEmail, "/ admin1234");
  }

  const existingProject = await prisma.project.findFirst({
    where: { ownerId: demoUser.id, name: "University Event Management System" },
  });
  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        name: "University Event Management System",
        description: "Plan and run campus events end-to-end — registration, scheduling, and check-in.",
        techStack: ["React", "Node.js", "PostgreSQL"],
        projectType: "Web app",
        deadline: new Date(Date.now() + 30 * 86400000),
        ownerId: demoUser.id,
        members: { create: [{ userId: demoUser.id, role: "owner", label: "Owner" }] },
      },
    });

    await prisma.task.createMany({
      data: [
        { projectId: project.id, title: "Login page", status: "todo", priority: "medium", createdById: demoUser.id },
        { projectId: project.id, title: "Register API", status: "in_progress", priority: "high", createdById: demoUser.id },
        { projectId: project.id, title: "Payment API", status: "review", priority: "high", createdById: demoUser.id },
        { projectId: project.id, title: "Database schema", status: "done", priority: "medium", createdById: demoUser.id },
      ],
    });
    console.log("Seeded demo project + tasks");
  }

  console.log("Seed complete.");
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding users...");

  const users = [
    { username: "Alice", email: "alice@example.com", password: "pass123" },
    { username: "Bob", email: "bob@example.com", password: "pass123" },
    { username: "Charlie", email: "charlie@example.com", password: "pass123" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  console.log("Seeding finished!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');

const oldDbUrl = "postgresql://neondb_owner:npg_1uzVLJZKi2EF@ep-raspy-fire-b1u2jokn-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const oldPrisma = new PrismaClient({ datasources: { db: { url: oldDbUrl } } });
const newPrisma = new PrismaClient();

async function inspect() {
  console.log("==================== بررسی مدل‌های PRISMA ====================");
  const models = Object.keys(oldPrisma).filter((key) => !key.startsWith('$') && !key.startsWith('_'));
  console.log("مدل‌های شناسایی‌شده در Prisma Client:", models);

  console.log("\n==================== بررسی تعداد داده‌ها در NEON ====================");
  for (const model of models) {
    try {
      if (oldPrisma[model] && typeof oldPrisma[model].count === 'function') {
        const count = await oldPrisma[model].count();
        console.log(`- ${model}: ${count} ردیف`);
      }
    } catch (e) {
      console.log(`- ${model}: خطا در شمارش (${e.message})`);
    }
  }

  console.log("\n==================== بررسی نمونه پرامپت (پوشش subId و روابط) ====================");
  try {
    if (oldPrisma.prompt) {
      const samplePrompt = await oldPrisma.prompt.findFirst({
        where: { subId: { not: null } },
      });
      console.log("نمونه پرامپت دارای subId:", samplePrompt || "هیچ پرامپتی با subId غیرنال یافت نشد.");
    }
  } catch (e) {
    console.log("خطا در دریافت نمونه پرامپت:", e.message);
  }

  console.log("\n==================== بررسی مقادیر subId موجود در PROMPT ====================");
  try {
    if (oldPrisma.prompt) {
      const promptsWithSub = await oldPrisma.prompt.findMany({
        where: { subId: { not: null } },
        select: { id: true, subId: true, categoryId: true },
        take: 10,
      });
      console.log("۱۰ نمونه subId از پرامپت‌ها:", promptsWithSub);
    }
  } catch (e) {
    console.log("خطا در بررسی subIdها:", e.message);
  }

  await oldPrisma.$disconnect();
  await newPrisma.$disconnect();
}

inspect();
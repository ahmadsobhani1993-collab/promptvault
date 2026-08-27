const { PrismaClient } = require('@prisma/client');

const oldDbUrl = "postgresql://neondb_owner:npg_1uzVLJZKi2EF@ep-raspy-fire-b1u2jokn-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const oldPrisma = new PrismaClient({ datasources: { db: { url: oldDbUrl } } });
const newPrisma = new PrismaClient();

async function chunkedTransfer(modelName, fetchFn, createFn, batchSize = 10) {
  try {
    const data = await fetchFn();
    if (!data || data.length === 0) {
      console.log(`ℹ️ جدول ${modelName} خالی است یا دیتایی برای آن یافت نشد.`);
      return;
    }
    console.log(`📦 در حال انتقال ${data.length} ردیف برای جدول ${modelName}...`);

    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      await createFn(chunk);
    }
    console.log(`✅ جدول ${modelName} با موفقیت منتقل شد.`);
  } catch (err) {
    console.error(`❌ ارور در جدول ${modelName}:`, err.message);
  }
}

async function transfer500Prompts() {
  console.log("🚀 شروع انتقال ۵۰۰ پرامپت اخیر + تعاملات وابسته از Neon به Supabase...\n");

  // ۱. دریافت کاربران و زیردسته‌های موجود در Supabase جهت اعتبار سنجی Foreign Keys
  const existingUsers = await newPrisma.user.findMany({ select: { id: true } });
  const validUserIds = new Set(existingUsers.map((u) => u.id));

  const existingSubs = await newPrisma.sub.findMany({ select: { id: true } });
  const validSubIds = new Set(existingSubs.map((s) => s.id));

  // ۲. استخراج ۵۰۰ پرامپت اخیر
  console.log("🔍 در حال استخراج ۵۰۰ پرامپت اخیر از Neon...");
  const recentPrompts = await oldPrisma.prompt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // پاکسازیuserId و subIdهای غیرمعتبر
  const cleanedPrompts = recentPrompts.map((p) => ({
    ...p,
    userId: p.userId && validUserIds.has(p.userId) ? p.userId : null,
    subId: p.subId && validSubIds.has(p.subId) ? p.subId : null,
  }));

  // ۳. انتقال ۵۰۰ پرامپت در دسته‌های ۵ تایی
  await chunkedTransfer(
    'prompt (500 مورد اخیر)',
    async () => cleanedPrompts,
    (d) => newPrisma.prompt.createMany({ data: d, skipDuplicates: true }),
    5
  );

  // دریافت شناسه واقعی پرامپت‌های منتقل شده در Supabase
  const insertedPrompts = await newPrisma.prompt.findMany({ select: { id: true } });
  const validPromptIds = new Set(insertedPrompts.map((p) => p.id));

  console.log(`\n📌 تعداد ${validPromptIds.size} پرامپت در Supabase ثبت شد. در حال انتقال جداول وابسته...`);

  // ۴. تصاویر پرامپت‌ها
  await chunkedTransfer(
    'promptImage',
    async () => {
      const images = await oldPrisma.promptImage.findMany();
      return images.filter((img) => validPromptIds.has(img.promptId));
    },
    (d) => newPrisma.promptImage.createMany({ data: d, skipDuplicates: true }),
    10
  );

  // ۵. لایک‌ها (like)
  await chunkedTransfer(
    'like',
    async () => {
      const likes = await oldPrisma.like.findMany();
      return likes.filter((l) => validPromptIds.has(l.promptId) && validUserIds.has(l.userId));
    },
    (d) => newPrisma.like.createMany({ data: d, skipDuplicates: true })
  );

  // ۶. ذخیره‌ها (save)
  await chunkedTransfer(
    'save',
    async () => {
      const saves = await oldPrisma.save.findMany();
      return saves.filter((s) => validPromptIds.has(s.promptId) && validUserIds.has(s.userId));
    },
    (d) => newPrisma.save.createMany({ data: d, skipDuplicates: true })
  );

  // ۷. کامنت‌ها (comment)
  await chunkedTransfer(
    'comment',
    async () => {
      const comments = await oldPrisma.comment.findMany();
      return comments.filter((c) => validPromptIds.has(c.promptId) && (c.userId ? validUserIds.has(c.userId) : true));
    },
    (d) => newPrisma.comment.createMany({ data: d, skipDuplicates: true })
  );

  console.log("\n🎉 انتقال ۵۰۰ پرامپت و تمامی داده‌های وابسته با موفقیت کامل شد!");
  await oldPrisma.$disconnect();
  await newPrisma.$disconnect();
}

transfer500Prompts();
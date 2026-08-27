const { PrismaClient } = require('@prisma/client');

console.log("--------------------------------------------------");
console.log("🔍 [DEBUG] Starting DB Connection Diagnostic Tool");
console.log("--------------------------------------------------");

// ۱. بررسی متغیرهای محیطی
console.log("🌐 ENV DATABASE_URL:", process.env.DATABASE_URL ? "Defined" : "MISSING!");
if (process.env.DATABASE_URL) {
  // پنهان کردن پسورد برای امنیت لاگ
  const safeUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log("📌 DATABASE_URL Format:", safeUrl);
}

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function runDiagnostics() {
  try {
    console.log("\n⚡ Step 1: Attempting simple connection check...");
    const result = await prisma.$queryRaw`SELECT NOW(), current_setting('max_connections') as max_conn;`;
    console.log("✅ Success! Server Time & Max Conn:", result);

    console.log("\n⚡ Step 2: Testing prepared statement behavior with multiple queries...");
    for (let i = 1; i <= 3; i++) {
      console.log(`> Executing query iteration #${i}...`);
      const categories = await prisma.category.findMany({ take: 1 });
      console.log(`  Fetched category count: ${categories.length}`);
    }

    console.log("\n🎉 ALL TESTS PASSED! Database connection and pooling settings are correct.");
  } catch (error) {
    console.log("\n❌ DIAGNOSTIC FAILED!");
    console.log("--------------------------------------------------");
    console.log("Error Name:", error.name);
    console.log("Error Message:", error.message);
    console.log("Error Code:", error.code || error.meta || "N/A");
    console.log("--------------------------------------------------");
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Disconnected Prisma Client.");
  }
}

runDiagnostics();
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { username: null }
  })
  console.log(`Found ${users.length} users without username.`)

  for (const user of users) {
    let base = user.name ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
    if (!base || base.length < 3) base = 'user'
    const hash = crypto.randomBytes(3).toString('hex')
    const uniqueUsername = `${base}_${hash}`

    await prisma.user.update({
      where: { id: user.id },
      data: { username: uniqueUsername }
    })
    console.log(`User ${user.email || user.id} updated with username: ${uniqueUsername}`)
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect())

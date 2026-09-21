const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name")
  .then(rows => {
    for (const r of rows) {
      console.log(r.tbl_name, '->', r.name);
      console.log('   ', r.sql);
    }
  })
  .then(() => p.$disconnect())
  .catch(err => { console.error(err); process.exit(1); });

// Generate bcrypt hash for admin password
const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'admin123456';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nUse this hash in init-db.js');
}

generateHash().catch(console.error);

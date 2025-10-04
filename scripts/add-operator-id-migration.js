// Migration script to add operator_id to transactions table
const pool = require('../db/database');

async function migrate() {
  try {
    console.log('Starting migration: Add operator_id to transactions table...');
    
    // Check if column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'operator_id'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Column operator_id already exists. Skipping migration.');
      return;
    }
    
    // Add operator_id column
    console.log('Adding operator_id column...');
    await pool.query('ALTER TABLE transactions ADD COLUMN operator_id INTEGER');
    
    // Add foreign key constraint
    console.log('Adding foreign key constraint...');
    await pool.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_operator 
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    
    // Add index
    console.log('Adding index...');
    await pool.query('CREATE INDEX idx_transactions_operator_id ON transactions(operator_id)');
    
    // Add comment
    console.log('Adding column comment...');
    await pool.query(`
      COMMENT ON COLUMN transactions.operator_id IS '操作员ID (用于管理员调整余额的审计追踪)'
    `);
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('Migration finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });

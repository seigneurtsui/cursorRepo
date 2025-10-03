// Fix duplicate payment plans script
const { Pool } = require('pg');

async function fixDuplicatePlans() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Starting to fix duplicate payment plans...');

    // Step 1: Show current duplicates
    const beforeResult = await pool.query(`
      SELECT type, COUNT(*) as count
      FROM payment_plans
      GROUP BY type
      HAVING COUNT(*) > 1
    `);

    if (beforeResult.rows.length > 0) {
      console.log('⚠️  Found duplicate plans:');
      beforeResult.rows.forEach(row => {
        console.log(`   - ${row.type}: ${row.count} copies`);
      });
    } else {
      console.log('✅ No duplicates found!');
      await pool.end();
      return;
    }

    // Step 2: Delete duplicates, keeping the one with lowest ID for each type
    const deleteResult = await pool.query(`
      DELETE FROM payment_plans
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM payment_plans
        GROUP BY type
      )
      RETURNING id, name, type
    `);

    if (deleteResult.rows.length > 0) {
      console.log(`\n🗑️  Deleted ${deleteResult.rows.length} duplicate plan(s):`);
      deleteResult.rows.forEach(row => {
        console.log(`   - ID ${row.id}: ${row.name} (${row.type})`);
      });
    }

    // Step 3: Add UNIQUE constraint to type column
    try {
      await pool.query(`
        ALTER TABLE payment_plans 
        ADD CONSTRAINT payment_plans_type_key UNIQUE (type)
      `);
      console.log('\n✅ Added UNIQUE constraint to type column');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('\n✅ UNIQUE constraint already exists');
      } else {
        throw err;
      }
    }

    // Step 4: Verify final state
    const finalResult = await pool.query(`
      SELECT id, name, type, price, description
      FROM payment_plans
      ORDER BY price
    `);

    console.log('\n📊 Final payment plans:');
    console.log('┌────┬──────────┬─────────┬────────┬────────────────────────────┐');
    console.log('│ ID │   名称   │  类型   │  价格  │          描述              │');
    console.log('├────┼──────────┼─────────┼────────┼────────────────────────────┤');
    finalResult.rows.forEach(row => {
      const id = String(row.id).padEnd(2);
      const name = row.name.padEnd(8);
      const type = row.type.padEnd(7);
      const price = `¥${parseFloat(row.price).toFixed(2)}`.padEnd(6);
      const desc = (row.description || '').substring(0, 26).padEnd(26);
      console.log(`│ ${id} │ ${name} │ ${type} │ ${price} │ ${desc} │`);
    });
    console.log('└────┴──────────┴─────────┴────────┴────────────────────────────┘');

    console.log('\n✅ All done! Duplicate plans have been removed.');

    await pool.end();
  } catch (error) {
    console.error('❌ Error fixing duplicate plans:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run the fix
fixDuplicatePlans();

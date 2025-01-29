import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.VITE_DB_USER,
  password: process.env.VITE_DB_PASSWORD,
  host: process.env.VITE_DB_HOST,
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
  database: process.env.VITE_DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  const client = await pool.connect();
  
  try {
    console.log('Testing database connection...');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Connection successful!');
    console.log('Current database time:', result.rows[0].current_time);
    
    // Test table existence
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('\nAvailable tables:', tables.rows.map(row => row.table_name));
    
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testConnection().catch(console.error);
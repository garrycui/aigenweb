import pkg from 'pg';
const { Client } = pkg;

const config = {
  host: process.env.VITE_DB_HOST || '104.154.177.118',
  database: process.env.VITE_DB_NAME || 'postgres',
  user: process.env.VITE_DB_USER || 'postgres',
  password: process.env.VITE_DB_PASSWORD || '19910331',
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false // Required for GCP Cloud SQL
  }
};

async function testConnection() {
  const client = new Client(config);

  try {
    console.log('Attempting to connect to database...');
    await client.connect();
    console.log('Successfully connected to database!');

    // Test basic query
    console.log('Testing basic query...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Current database time:', result.rows[0].current_time);

    // Test table existence
    console.log('\nChecking table existence...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Available tables:', tables.rows.map(row => row.table_name));

  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await client.end();
    console.log('Connection closed');
  }
}

testConnection().catch(console.error);
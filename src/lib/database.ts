import { Pool } from 'pg';

// Create a connection pool
const pool = new Pool({
  user: process.env.VITE_DB_USER,
  password: process.env.VITE_DB_PASSWORD,
  host: process.env.VITE_DB_HOST,
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
  database: process.env.VITE_DB_NAME,
  ssl: {
    rejectUnauthorized: false // Required for GCP Cloud SQL
  }
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

export const query = async (text: string, params?: any[]) => {
  try {
    const result = await pool.query(text, params);
    return { data: result.rows, error: null };
  } catch (error) {
    console.error('Database query error:', error);
    return { data: null, error };
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};
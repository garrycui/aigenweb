import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  host: '104.154.177.118',
  database: 'postgres',
  user: 'postgres',
  password: '19910331',
  port: 5432,
  ssl: {
    rejectUnauthorized: false // Required for GCP Cloud SQL
  }
};

async function migrate() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log('Connected to database');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Read and execute migration files
    const migrations = [
      'create_auth_schema.sql',
      'create_assessments.sql',
      'create_forum.sql'
    ];

    for (const migration of migrations) {
      const exists = await client.query(
        'SELECT id FROM migrations WHERE name = $1',
        [migration]
      );

      if (exists.rows.length === 0) {
        const sql = readFileSync(join(__dirname, '..', 'migrations', migration), 'utf8');
        console.log(`Executing migration: ${migration}`);
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration]
        );
        console.log(`Completed migration: ${migration}`);
      } else {
        console.log(`Skipping migration ${migration} - already executed`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);
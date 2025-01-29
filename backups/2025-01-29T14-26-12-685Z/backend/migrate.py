import psycopg2
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

def migrate():
    conn = psycopg2.connect(
        host=os.getenv("VITE_DB_HOST"),
        database=os.getenv("VITE_DB_NAME"),
        user=os.getenv("VITE_DB_USER"),
        password=os.getenv("VITE_DB_PASSWORD"),
        port=os.getenv("VITE_DB_PORT"),
        sslmode='require'
    )
    
    try:
        cur = conn.cursor()
        
        # Create migrations table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        
        # Get list of migration files
        migrations_dir = Path(__file__).parent / 'migrations'
        migration_files = sorted(migrations_dir.glob('*.sql'))
        
        for migration_file in migration_files:
            # Check if migration has been executed
            cur.execute(
                "SELECT id FROM migrations WHERE name = %s",
                (migration_file.name,)
            )
            if not cur.fetchone():
                print(f"Executing migration: {migration_file.name}")
                
                # Read and execute migration
                with open(migration_file) as f:
                    sql = f.read()
                    cur.execute(sql)
                
                # Record migration
                cur.execute(
                    "INSERT INTO migrations (name) VALUES (%s)",
                    (migration_file.name,)
                )
                conn.commit()
                print(f"Completed migration: {migration_file.name}")
            else:
                print(f"Skipping migration {migration_file.name} - already executed")
        
        print("All migrations completed successfully")
        
    except Exception as e:
        print("Migration failed:", str(e))
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
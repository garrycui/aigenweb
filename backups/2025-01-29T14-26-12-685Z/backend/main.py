from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
def get_db():
    conn = psycopg2.connect(
        host=os.getenv("VITE_DB_HOST"),
        database=os.getenv("VITE_DB_NAME"),
        user=os.getenv("VITE_DB_USER"),
        password=os.getenv("VITE_DB_PASSWORD"),
        port=os.getenv("VITE_DB_PORT"),
        cursor_factory=RealDictCursor,
        sslmode='require'
    )
    try:
        yield conn
    finally:
        conn.close()

# Routes
@app.get("/api/posts")
async def get_posts(db = Depends(get_db)):
    try:
        cur = db.cursor()
        cur.execute("""
            SELECT p.*, u.name as user_name
            FROM forum_posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.likes_count DESC
            LIMIT 5
        """)
        posts = cur.fetchall()
        return {"data": posts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/posts/{post_id}")
async def get_post(post_id: str, db = Depends(get_db)):
    try:
        cur = db.cursor()
        cur.execute("""
            SELECT 
                p.*,
                u.name as user_name,
                json_agg(
                    json_build_object(
                        'id', c.id,
                        'content', c.content,
                        'likes_count', c.likes_count,
                        'created_at', c.created_at,
                        'user_id', cu.id,
                        'user_name', cu.name,
                        'replies', (
                            SELECT json_agg(
                                json_build_object(
                                    'id', r.id,
                                    'content', r.content,
                                    'likes_count', r.likes_count,
                                    'created_at', r.created_at,
                                    'user_id', ru.id,
                                    'user_name', ru.name
                                )
                            )
                            FROM forum_replies r
                            JOIN users ru ON r.user_id = ru.id
                            WHERE r.comment_id = c.id
                        )
                    )
                ) as comments
            FROM forum_posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN forum_comments c ON c.post_id = p.id
            LEFT JOIN users cu ON c.user_id = cu.id
            WHERE p.id = %s
            GROUP BY p.id, u.id
        """, (post_id,))
        post = cur.fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        return {"data": post}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
import { query } from './database';

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url?: string;
  video_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user: {
    id: string;
    name: string;
  };
  is_liked?: boolean;
}

export interface ForumComment {
  id: string;
  content: string;
  likes_count: number;
  created_at: string;
  user: {
    id: string;
    name: string;
  };
  replies?: ForumReply[];
  is_liked?: boolean;
}

export interface ForumReply {
  id: string;
  content: string;
  likes_count: number;
  created_at: string;
  user: {
    id: string;
    name: string;
  };
  is_liked?: boolean;
}

export const fetchPosts = async (userId: string | null) => {
  try {
    const { data: posts, error } = await query(`
      SELECT p.*, u.name as user_name
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.likes_count DESC
      LIMIT 5
    `);

    if (error) throw error;

    if (userId) {
      // Get user's likes for these posts
      const { data: likes } = await query(
        'SELECT post_id FROM forum_likes WHERE user_id = $1',
        [userId]
      );

      const likedPostIds = new Set(likes?.map(l => l.post_id));

      return posts.map((post: any) => ({
        ...post,
        user: {
          id: post.user_id,
          name: post.user_name
        },
        is_liked: likedPostIds.has(post.id)
      }));
    }

    return posts.map((post: any) => ({
      ...post,
      user: {
        id: post.user_id,
        name: post.user_name
      }
    }));
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};

export const fetchPost = async (postId: string, userId: string | null) => {
  try {
    const { data: post, error } = await query(`
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
      WHERE p.id = $1
      GROUP BY p.id, u.id
    `, [postId]);

    if (error) throw error;

    if (userId) {
      // Get user's likes
      const { data: likes } = await query(`
        SELECT post_id, comment_id, reply_id 
        FROM forum_likes 
        WHERE user_id = $1
      `, [userId]);

      const likedPosts = new Set(likes?.filter(l => l.post_id).map(l => l.post_id));
      const likedComments = new Set(likes?.filter(l => l.comment_id).map(l => l.comment_id));
      const likedReplies = new Set(likes?.filter(l => l.reply_id).map(l => l.reply_id));

      return {
        ...post,
        user: {
          id: post.user_id,
          name: post.user_name
        },
        is_liked: likedPosts.has(post.id),
        comments: post.comments.map((comment: any) => ({
          ...comment,
          user: {
            id: comment.user_id,
            name: comment.user_name
          },
          is_liked: likedComments.has(comment.id),
          replies: comment.replies?.map((reply: any) => ({
            ...reply,
            user: {
              id: reply.user_id,
              name: reply.user_name
            },
            is_liked: likedReplies.has(reply.id)
          }))
        }))
      };
    }

    return {
      ...post,
      user: {
        id: post.user_id,
        name: post.user_name
      },
      comments: post.comments.map((comment: any) => ({
        ...comment,
        user: {
          id: comment.user_id,
          name: comment.user_name
        },
        replies: comment.replies?.map((reply: any) => ({
          ...reply,
          user: {
            id: reply.user_id,
            name: reply.user_name
          }
        }))
      }))
    };
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};

export const createPost = async (
  userId: string,
  data: {
    title: string;
    content: string;
    category: string;
    image_url?: string;
    video_url?: string;
  }
) => {
  try {
    const { data: post, error } = await query(
      `INSERT INTO forum_posts (user_id, title, content, category, image_url, video_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, data.title, data.content, data.category, data.image_url, data.video_url]
    );

    if (error) throw error;
    return post;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export const toggleLike = async (
  userId: string,
  type: 'post' | 'comment' | 'reply',
  id: string
) => {
  try {
    const field = `${type}_id`;
    
    // Check if like exists
    const { data: existingLike } = await query(
      `SELECT id FROM forum_likes 
       WHERE user_id = $1 AND ${field} = $2`,
      [userId, id]
    );

    if (existingLike?.length) {
      // Unlike
      const { error } = await query(
        'DELETE FROM forum_likes WHERE id = $1',
        [existingLike[0].id]
      );

      if (error) throw error;
      return false;
    } else {
      // Like
      const { error } = await query(
        `INSERT INTO forum_likes (user_id, ${field})
         VALUES ($1, $2)`,
        [userId, id]
      );

      if (error) throw error;
      return true;
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

export const addComment = async (
  userId: string,
  postId: string,
  content: string
) => {
  try {
    const { data: comment, error } = await query(
      `INSERT INTO forum_comments (user_id, post_id, content)
       VALUES ($1, $2, $3)
       RETURNING c.*, u.name as user_name
       FROM forum_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = (SELECT currval('forum_comments_id_seq'))`,
      [userId, postId, content]
    );

    if (error) throw error;

    return {
      ...comment,
      user: {
        id: comment.user_id,
        name: comment.user_name
      },
      replies: []
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

export const addReply = async (
  userId: string,
  commentId: string,
  content: string
) => {
  try {
    const { data: reply, error } = await query(
      `INSERT INTO forum_replies (user_id, comment_id, content)
       VALUES ($1, $2, $3)
       RETURNING r.*, u.name as user_name
       FROM forum_replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = (SELECT currval('forum_replies_id_seq'))`,
      [userId, commentId, content]
    );

    if (error) throw error;

    return {
      ...reply,
      user: {
        id: reply.user_id,
        name: reply.user_name
      }
    };
  } catch (error) {
    console.error('Error adding reply:', error);
    throw error;
  }
};

export const formatTimeAgo = (date: string) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
};
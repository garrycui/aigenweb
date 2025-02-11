import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MessageSquare, ThumbsUp, Clock, Share2, Bookmark, ArrowLeft } from 'lucide-react';
import { fetchPost, createComment, createReply, toggleLike } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Reply {
  id: string;
  content: string;
  likes_count: number;
  created_at: any;
  userId: string;
  user_name: string;
  is_liked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  likes_count: number;
  created_at: any;
  userId: string;
  user_name: string;
  replies: Reply[];
  is_liked?: boolean;
}

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url?: string;
  video_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: any;
  userId: string;
  user_name: string;
  comments: Comment[];
  is_liked?: boolean;
}

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<{commentId: string} | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const handleLike = async (type: 'post' | 'comment' | 'reply', itemId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const isLiked = await toggleLike(type, itemId, user.id);
      
      // Update local state based on type
      if (type === 'post' && post) {
        setPost({
          ...post,
          likes_count: post.likes_count + (isLiked ? 1 : -1),
          is_liked: isLiked
        });
      } else if (type === 'comment') {
        setPost(currentPost => {
          if (!currentPost) return null;
          return {
            ...currentPost,
            comments: currentPost.comments.map(comment =>
              comment.id === itemId
                ? { ...comment, likes_count: comment.likes_count + (isLiked ? 1 : -1), is_liked: isLiked }
                : comment
            )
          };
        });
      } else if (type === 'reply') {
        setPost(currentPost => {
          if (!currentPost) return null;
          return {
            ...currentPost,
            comments: currentPost.comments.map(comment => ({
              ...comment,
              replies: comment.replies.map(reply =>
                reply.id === itemId
                  ? { ...reply, likes_count: reply.likes_count + (isLiked ? 1 : -1), is_liked: isLiked }
                  : reply
              )
            }))
          };
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const loadPost = async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      const response = await fetchPost(id);
      setPost(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load post. Please try again later.');
      console.error('Error loading post:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPost();
  }, [id]);

  const handleComment = async () => {
    if (!user || !post) {
      navigate('/login');
      return;
    }

    try {
      await createComment(post.id, user.id, user.name, newComment);
      setNewComment('');
      loadPost(); // Reload the post to show the new comment
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  const handleReply = async (commentId: string) => {
    if (!user || !post) {
      navigate('/login');
      return;
    }

    try {
      await createReply(post.id, commentId, user.id, user.name, replyContent);
      setReplyContent('');
      setReplyingTo(null);
      loadPost(); // Reload the post to show the new reply
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('Failed to post reply. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">
          {error || 'Post not found'}
        </h2>
        <Link to="/forum" className="text-indigo-600 hover:text-indigo-800 mt-4 inline-block">
          Return to Forum
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link 
        to="/forum"
        className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Forum
      </Link>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
              {post.category}
            </span>
            <div className="flex items-center text-gray-500 text-sm">
              <Clock className="h-4 w-4 mr-1" />
              {formatDate(post.created_at)}
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>
          <p className="text-gray-600 mb-6">{post.content}</p>

          {post.image_url && (
            <img
              src={post.image_url}
              alt="Post illustration"
              className="w-full h-96 object-cover rounded-lg mb-6"
            />
          )}

          {post.video_url && (
            <div className="w-full h-96 mb-6">
              <iframe
                src={post.video_url}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-lg"
              ></iframe>
            </div>
          )}
          <p className="mt-4 text-gray-600">
            {/* Your references here */}
          </p>
          
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleLike('post', post.id)}
                className={`flex items-center space-x-1 ${
                  post.is_liked
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                <ThumbsUp className={`h-5 w-5 ${post.is_liked ? 'fill-current' : ''}`} />
                <span>{post.likes_count}</span>
              </button>
              <button className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600">
                <MessageSquare className="h-5 w-5" />
                <span>{post.comments_count}</span>
              </button>
              <button className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600">
                <Share2 className="h-5 w-5" />
              </button>
              <button className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600">
                <Bookmark className="h-5 w-5" />
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Posted by <span className="font-medium">{post.user_name}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6">
          <h3 className="font-medium text-gray-900 mb-4">Comments</h3>
          <div className="space-y-4">
            {post.comments?.map(comment => (
              <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-gray-900">{comment.user_name}</span>
                    <span className="text-sm text-gray-500">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2">{comment.content}</p>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleLike('comment', comment.id)}
                      className={`text-sm ${
                        comment.is_liked
                          ? 'text-indigo-600'
                          : 'text-gray-500 hover:text-indigo-600'
                      }`}
                    >
                      <ThumbsUp
                        className={`h-4 w-4 inline mr-1 ${
                          comment.is_liked ? 'fill-current' : ''
                        }`}
                      />
                      {comment.likes_count}
                    </button>
                    <button
                      onClick={() => setReplyingTo({ commentId: comment.id })}
                      className="text-sm text-gray-500 hover:text-indigo-600"
                    >
                      Reply
                    </button>
                  </div>

                  {replyingTo?.commentId === comment.id && (
                    <div className="mt-2">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write your reply..."
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={2}
                      />
                      <div className="flex justify-end space-x-2 mt-2">
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReply(comment.id)}
                          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                          disabled={!replyContent.trim()}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}

                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-4 mt-2 space-y-2">
                      {comment.replies.map(reply => (
                        <div key={reply.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-gray-900">{reply.user_name}</span>
                            <span className="text-sm text-gray-500">
                              {formatDate(reply.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-600">{reply.content}</p>
                          <button
                            onClick={() => handleLike('reply', reply.id)}
                            className={`text-sm mt-1 ${
                              reply.is_liked
                                ? 'text-indigo-600'
                                : 'text-gray-500 hover:text-indigo-600'
                            }`}
                          >
                            <ThumbsUp
                              className={`h-4 w-4 inline mr-1 ${
                                reply.is_liked ? 'fill-current' : ''
                              }`}
                            />
                            {reply.likes_count}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleComment}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                disabled={!newComment.trim()}
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
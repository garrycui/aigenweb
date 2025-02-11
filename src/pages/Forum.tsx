import { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AIChat from '../components/AIChat';
import { fetchPosts, toggleLike } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url?: string;
  video_url?: string;
  likes_count: number;
  comments_count: number;
  createdAt: any;
  user_name: string;
  user_id: string;
  is_liked?: boolean;
}

const Forum = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
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
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    return date.toLocaleDateString();
  };

  useEffect(() => {
    const loadPosts = async () => {
      try {
        setIsLoading(true);
        const { data } = await fetchPosts();
        const formattedData = data.map((post: any) => ({
          id: post.id,
          title: post.title || '',
          content: post.content || '',
          category: post.category || '',
          image_url: post.image_url,
          video_url: post.video_url,
          likes_count: post.likes_count,
          comments_count: post.comments_count,
          createdAt: post.createdAt,
          user_name: post.user_name || '',
          user_id: post.user_id || '',
          is_liked: post.is_liked || false,
        }));
        setPosts(formattedData || []);
      } catch (err) {
        console.error('Error loading posts:', err);
        setError('Failed to load posts. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPosts();
  }, []);

  const handleLike = async (postId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const isLiked = await toggleLike('post', postId, user.id);
      
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId
            ? { 
                ...post, 
                likes_count: post.likes_count + (isLiked ? 1 : -1),
                is_liked: isLiked
              }
            : post
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Community Forum</h1>
            <p className="text-gray-600">Share your AI journey and learn from others</p>
          </div>
        </div>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Community Forum</h1>
            <p className="text-gray-600">Share your AI journey and learn from others</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Forum</h1>
          <p className="text-gray-600">Top posts from this week</p>
        </div>
        <Link
          to="/forum/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-center"
        >
          Share Your Story
        </Link>
      </div>

      <AIChat />

      {posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600">No posts yet. Be the first to share your story!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full w-fit">
                    {post.category}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatTimeAgo(post.createdAt)}
                  </span>
                </div>
                
                <Link to={`/forum/${post.id}`}>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
                    {post.title}
                  </h2>
                </Link>
                
                <p className="text-gray-600 mb-4">
                  {post.content.length > 150 ? `${post.content.slice(0, 150)}...` : post.content}
                </p>

                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post illustration"
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center space-x-1 ${
                        post.is_liked
                          ? 'text-indigo-600'
                          : 'text-gray-500 hover:text-indigo-600'
                      }`}
                    >
                      {post.is_liked ? (
                        <ThumbsUp className="h-5 w-5 fill-current" />
                      ) : (
                        <ThumbsUp className="h-5 w-5" />
                      )}
                      <span>{post.likes_count || 0}</span>
                    </button>
                    <div className="flex items-center space-x-1 text-gray-500">
                      <MessageSquare className="h-5 w-5" />
                      <span>{post.comments_count || 0}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Posted by <span className="font-medium">{post.user_name}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Forum;
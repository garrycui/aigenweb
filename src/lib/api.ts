import { 
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp,
  startAfter
} from 'firebase/firestore';
import { db } from './firebase';
import { forumCache, postCache, assessmentCache} from './cache';
import { updateUser, getUser } from './cache'; // Import user service

// Calculate AI preference based on assessment answers
const calculateAIPreference = (answers: any[]) => {
  const aiToolResponse = answers.find(a => a.question_id === 5)?.answer || '';
  const aiImpactResponse = answers.find(a => a.question_id === 6)?.answer || '';
  
  const toolScores: { [key: string]: number } = {
    "Dive right in and experiment": 4,
    "Wait for a training session": 3,
    "Watch colleagues use it first": 2,
    "Prefer to avoid using it unless necessary": 1
  };

  const impactScores: { [key: string]: number } = {
    "Excited about the possibilities": 4,
    "Cautiously optimistic": 3,
    "Somewhat concerned": 2,
    "Very worried": 1
  };

  const toolScore = toolScores[aiToolResponse] || 2;
  const impactScore = impactScores[aiImpactResponse] || 2;
  const averageScore = (toolScore + impactScore) / 2;

  if (averageScore >= 3.5) return 'enthusiastic';
  if (averageScore >= 2.5) return 'optimistic';
  if (averageScore >= 1.5) return 'cautious';
  return 'resistant';
};

// Assessment Functions
export const saveAssessment = async (userId: string, assessmentData: any) => {
  try {
    const aiPreference = calculateAIPreference(assessmentData.answers);

    const assessmentRef = await addDoc(collection(db, 'assessments'), {
      userId: userId,
      mbti_type: assessmentData.mbti_type,
      ai_preference: aiPreference,
      createdAt: serverTimestamp()
    });

    const answers = assessmentData.answers || [];
    await Promise.all(answers.map(async (answer: any) => {
      await addDoc(collection(db, 'assessments', assessmentRef.id, 'answers'), {
        question_id: answer.question_id,
        answer: answer.answer,
        createdAt: serverTimestamp()
      });
    }));

    // Update user document with assessment results using service function
    await updateUser(userId, {
      hasCompletedAssessment: true,
      mbtiType: assessmentData.mbti_type,
      aiPreference: aiPreference
    });

    // No need to invalidate user cache - updateUser does that

    // Still need to invalidate assessment cache
    assessmentCache.delete(`latest-assessment-${userId}`);

    return { data: { id: assessmentRef.id } };
  } catch (error) {
    console.error('Error saving assessment:', error);
    throw error;
  }
};

export const getLatestAssessment = async (userId: string) => {
  // Create a unique cache key for this user's latest assessment
  const cacheKey = `latest-assessment-${userId}`;

  // Use getOrSet to retrieve from cache or fetch from Firestore
  return assessmentCache.getOrSet(cacheKey, async () => {
    try {
      const assessmentsRef = collection(db, 'assessments');
      const q = query(
        assessmentsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return { data: null };
      }

      const assessmentDoc = querySnapshot.docs[0];
      const answersRef = collection(db, 'assessments', assessmentDoc.id, 'answers');
      const answersSnapshot = await getDocs(answersRef);

      const rawData = assessmentDoc.data() as {
        userId: string;
        mbti_type: string;
        ai_preference: string;
        createdAt: any;
      };

      const assessment = {
        id: assessmentDoc.id,
        ...rawData,
        answers: answersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };

      return { data: assessment };
    } catch (error) {
      console.error('Error fetching assessment:', error);
      return { data: null, error };
    }
  });
};

// Forum Functions
export const fetchPosts = async (
  sortBy: 'date' | 'likes' | 'comments' = 'date',
  page: number = 1,
  lastVisibleId?: string
) => {
  // Create a unique cache key based on sort method, page, and cursor
  const cacheKey = lastVisibleId 
    ? `posts-${sortBy}-after-${lastVisibleId}` 
    : `posts-${sortBy}-page${page}`;
  
  return forumCache.getOrSet(cacheKey, async () => {
    try {
      const postsRef = collection(db, 'posts');
      let q;
      
      // Apply sorting based on sortBy parameter
      const orderByField = sortBy === 'date' ? 'createdAt' : 
                          sortBy === 'likes' ? 'likes_count' : 'comments_count';
      
      // If we have a last document ID, use it for pagination
      if (lastVisibleId) {
        // First, get the document to use as cursor
        const lastDocRef = doc(db, 'posts', lastVisibleId);
        const lastDocSnap = await getDoc(lastDocRef);
        
        if (lastDocSnap.exists()) {
          q = query(
            postsRef, 
            orderBy(orderByField, 'desc'),
            startAfter(lastDocSnap),
            limit(10)
          );
        } else {
          // Fallback if document doesn't exist
          q = query(postsRef, orderBy(orderByField, 'desc'), limit(10));
        }
      } else {
        // First page, no cursor needed
        q = query(postsRef, orderBy(orderByField, 'desc'), limit(10));
      }
      
      const querySnapshot = await getDocs(q);
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      
      const posts = await Promise.all(querySnapshot.docs.map(async (postDoc) => {
        // ... existing post mapping code ...
        const data = postDoc.data();
        const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
        const commentsCount = commentsSnapshot.size;
        const likesSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'likes'));
        const likesCount = likesSnapshot.size;
        return {
          id: postDoc.id,
          title: data.title,
          content: data.content,
          category: data.category,
          image_url: data.image_url,
          video_url: data.video_url,
          likes_count: likesCount,
          comments_count: commentsCount,
          createdAt: data.createdAt,
          user_name: data.user_name,
          user_id: data.userId
        };
      }));

      // Return both the posts data and pagination info
      return { 
        data: posts,
        pagination: {
          hasMore: posts.length === 10,
          lastVisible: lastVisible?.id || null
        }
      };
    } catch (error) {
      console.error('Error fetching posts:', error);
      return { 
        data: [], 
        pagination: { hasMore: false, lastVisible: null },
        error 
      };
    }
  });
};

export const searchPosts = async (
  query: string,
  sortBy: 'date' | 'likes' | 'comments' = 'date',
  page: number = 1
) => {
  // Create a unique cache key based on search query, sort method and page
  const cacheKey = `search-${query.replace(/\s+/g, '-')}-${sortBy}-page${page}`;
  
  return forumCache.getOrSet(cacheKey, async () => {
    try {
      const postsRef = collection(db, 'posts');
      const querySnapshot = await getDocs(postsRef);
      
      // Filter posts that match the search query
      let matchedPosts = querySnapshot.docs.filter(doc => {
        const data = doc.data();
        const title = data.title?.toLowerCase() || '';
        const content = data.content?.toLowerCase() || '';
        const searchQuery = query.toLowerCase();
        return title.includes(searchQuery) || content.includes(searchQuery);
      });
      
      // Sort based on sortBy parameter
      if (sortBy === 'likes') {
        matchedPosts = matchedPosts.sort((a, b) => 
          (b.data().likes_count || 0) - (a.data().likes_count || 0)
        );
      } else if (sortBy === 'comments') {
        matchedPosts = matchedPosts.sort((a, b) => 
          (b.data().comments_count || 0) - (a.data().comments_count || 0)
        );
      } else {
        matchedPosts = matchedPosts.sort((a, b) => 
          b.data().createdAt - a.data().createdAt
        );
      }
      
      // Apply pagination
      const paginatedPosts = matchedPosts.slice((page - 1) * 10, page * 10);
      
      const posts = await Promise.all(paginatedPosts.map(async (postDoc) => {
        const data = postDoc.data();
        const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
        const commentsCount = commentsSnapshot.size;
        const likesSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'likes'));
        const likesCount = likesSnapshot.size;
        return {
          id: postDoc.id,
          title: data.title,
          content: data.content,
          category: data.category,
          image_url: data.image_url,
          video_url: data.video_url,
          likes_count: likesCount,
          comments_count: commentsCount,
          createdAt: data.createdAt,
          user_name: data.user_name,
          user_id: data.userId
        };
      }));

      return { data: posts };
    } catch (error) {
      console.error('Error searching posts:', error);
      return { data: [], error };
    }
  });
};

export const fetchPost = async (postId: string) => {
  // Use post cache for individual post details
  const cacheKey = `post-${postId}`;
  
  return postCache.getOrSet(cacheKey, async () => {
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();

      const commentsRef = collection(db, 'posts', postId, 'comments');
      const commentsSnapshot = await getDocs(query(commentsRef, orderBy('createdAt', 'desc')));
      
      const comments = await Promise.all(commentsSnapshot.docs.map(async commentDoc => {
        const commentData = commentDoc.data();
        
        const repliesRef = collection(db, 'posts', postId, 'comments', commentDoc.id, 'replies');
        const repliesSnapshot = await getDocs(query(repliesRef, orderBy('createdAt', 'desc')));
        
        const commentLikesSnapshot = await getDocs(collection(db, 'posts', postId, 'comments', commentDoc.id, 'likes'));
        
        const replies = await Promise.all(repliesSnapshot.docs.map(async replyDoc => {
          const replyData = replyDoc.data();
          const replyLikesSnapshot = await getDocs(
            collection(db, 'posts', postId, 'comments', commentDoc.id, 'replies', replyDoc.id, 'likes')
          );

          return {
            id: replyDoc.id,
            content: replyData.content || '',
            userId: replyData.userId || '',
            user_name: replyData.user_name || '',
            likes_count: replyLikesSnapshot.size || 0,
            created_at: replyData.createdAt || null
          };
        }));

        return {
          id: commentDoc.id,
          content: commentData.content || '',
          userId: commentData.userId || '',
          user_name: commentData.user_name || '',
          likes_count: commentLikesSnapshot.size || 0,
          created_at: commentData.createdAt || null,
          replies
        };
      }));

      const likesSnapshot = await getDocs(collection(db, 'posts', postId, 'likes'));

      const post = {
        id: postDoc.id,
        title: postData.title || '',
        content: postData.content || '',
        category: postData.category || '',
        image_url: postData.image_url || '',
        video_url: postData.video_url || '',
        userId: postData.userId || '',
        user_name: postData.user_name || '',
        likes_count: likesSnapshot.size || 0,
        comments_count: comments.length || 0,
        created_at: postData.createdAt || null,
        comments
      };

      return { data: post };
    } catch (error) {
      console.error('Error fetching post:', error);
      throw error;
    }
  });
};
// Add cache invalidation function for forum posts
export const invalidateForumCache = () => {
  // Get all keys from forumCache and delete any that start with "posts-" or "search-"
  const keysToDelete = forumCache.keys()
    .filter(key => key.startsWith('posts-') || key.startsWith('search-'));
  
  keysToDelete.forEach(key => forumCache.delete(key));
  
  return keysToDelete.length;
};

// Update mutation functions to invalidate cache

export const createPost = async (userId: string, userName: string, title: string, content: string, category: string, imageUrl?: string, videoUrl?: string) => {
  try {
    // Original implementation
    const postRef = await addDoc(collection(db, 'posts'), {
      userId,
      user_name: userName,
      title,
      content,
      category,
      image_url: imageUrl,
      video_url: videoUrl,
      likes_count: 0,
      comments_count: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Get user data
    const userData = await getUser(userId);

    // Update user's publishedPosts array
    const publishedPosts = userData?.publishedPosts || [];
    await updateUser(userId, {
      publishedPosts: [...publishedPosts, postRef.id]
    });

    // Invalidate forum cache
    invalidateForumCache();
    
    return { data: { id: postRef.id } };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export const updatePost = async (postId: string, userId: string, updates: {
  title?: string;
  content?: string;
  category?: string;
  image_url?: string;
  video_url?: string;
}) => {
  try {
    // Original implementation
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    if (postDoc.data().userId !== userId) {
      throw new Error('Unauthorized to edit this post');
    }

    await updateDoc(postRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    // Invalidate both the specific post and forum listings
    postCache.delete(`post-${postId}`);
    invalidateForumCache();
    
    return { success: true };
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

export const deletePost = async (postId: string, userId: string) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    if (postDoc.data().userId !== userId) {
      throw new Error('Unauthorized to delete this post');
    }

    // Delete all comments and their replies
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const commentsSnapshot = await getDocs(commentsRef);
    
    await Promise.all(commentsSnapshot.docs.map(async (commentDoc) => {
      // Delete all replies for this comment
      const repliesRef = collection(commentsRef, commentDoc.id, 'replies');
      const repliesSnapshot = await getDocs(repliesRef);
      await Promise.all(repliesSnapshot.docs.map(replyDoc => deleteDoc(replyDoc.ref)));
      
      // Delete the comment
      await deleteDoc(commentDoc.ref);
    }));

    // Delete the post
    await deleteDoc(postRef);

    // Replace this direct Firestore code with updateUser
    const userData = await getUser(userId);
    if (userData) {
      const publishedPosts = userData.publishedPosts || [];
      await updateUser(userId, {
        publishedPosts: publishedPosts.filter((id: string) => id !== postId)
      });
      // No need to explicitly invalidate cache - updateUser does that
    }

    // Invalidate cache after deleting a post
    postCache.delete(`post-${postId}`);
    invalidateForumCache();
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

export const createComment = async (postId: string, userId: string, userName: string, content: string) => {
  try {
    const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), {
      userId,
      user_name: userName,
      content,
      likes_count: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Invalidate the specific post and forum listings since comment counts changed
    postCache.delete(`post-${postId}`);
    invalidateForumCache();
    
    return commentRef.id;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

export const updateComment = async (postId: string, commentId: string, userId: string, content: string) => {
  try {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);

    if (!commentDoc.exists()) {
      throw new Error('Comment not found');
    }

    if (commentDoc.data().userId !== userId) {
      throw new Error('Unauthorized to edit this comment');
    }

    await updateDoc(commentRef, {
      content,
      updatedAt: serverTimestamp()
    });

    // Invalidate just the specific post cache
    postCache.delete(`post-${postId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

export const deleteComment = async (postId: string, commentId: string, userId: string) => {
  try {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);

    if (!commentDoc.exists()) {
      throw new Error('Comment not found');
    }

    if (commentDoc.data().userId !== userId) {
      throw new Error('Unauthorized to delete this comment');
    }

    // Delete all replies for this comment
    const repliesRef = collection(commentRef, 'replies');
    const repliesSnapshot = await getDocs(repliesRef);
    await Promise.all(repliesSnapshot.docs.map(replyDoc => deleteDoc(replyDoc.ref)));

    // Delete the comment
    await deleteDoc(commentRef);

    // Invalidate both caches
    postCache.delete(`post-${postId}`);
    invalidateForumCache(); // Comment counts change affects listings
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

export const createReply = async (postId: string, commentId: string, userId: string, userName: string, content: string) => {
  try {
    const replyRef = await addDoc(
      collection(db, 'posts', postId, 'comments', commentId, 'replies'),
      {
        userId,
        user_name: userName,
        content,
        likes_count: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    // Invalidate post cache when a reply is added
    postCache.delete(`post-${postId}`);
    
    return { data: { id: replyRef.id } };
  } catch (error) {
    console.error('Error creating reply:', error);
    throw error;
  }
};

export const updateReply = async (postId: string, commentId: string, replyId: string, userId: string, content: string) => {
  try {
    const replyRef = doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId);
    const replyDoc = await getDoc(replyRef);

    if (!replyDoc.exists()) {
      throw new Error('Reply not found');
    }

    if (replyDoc.data().userId !== userId) {
      throw new Error('Unauthorized to edit this reply');
    }

    await updateDoc(replyRef, {
      content,
      updatedAt: serverTimestamp()
    });

    // Invalidate post cache when a reply is updated
    postCache.delete(`post-${postId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating reply:', error);
    throw error;
  }
};

export const deleteReply = async (postId: string, commentId: string, replyId: string, userId: string) => {
  try {
    const replyRef = doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId);
    const replyDoc = await getDoc(replyRef);

    if (!replyDoc.exists()) {
      throw new Error('Reply not found');
    }

    if (replyDoc.data().userId !== userId) {
      throw new Error('Unauthorized to delete this reply');
    }

    await deleteDoc(replyRef);

    // Invalidate post cache when a reply is deleted
    postCache.delete(`post-${postId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting reply:', error);
    throw error;
  }
};

export const toggleLike = async (
  type: 'post' | 'comment' | 'reply', 
  itemId: string, 
  userId: string,
  postId?: string // Add optional postId parameter for comment/reply likes
) => {
  try {
    const likesRef = collection(db, `${type}s`, itemId, 'likes');
    const userLikeQuery = query(likesRef, where('userId', '==', userId));
    const userLikeSnapshot = await getDocs(userLikeQuery);

    const isLiked = !userLikeSnapshot.empty;

    if (isLiked) {
      await deleteDoc(userLikeSnapshot.docs[0].ref);
    } else {
      await addDoc(likesRef, {
        userId,
        createdAt: serverTimestamp()
      });
    }

    // If liking/unliking a post, invalidate both caches
    if (type === 'post') {
      postCache.delete(`post-${itemId}`);
      invalidateForumCache(); // Like counts change affects listings
    } 
    // If liking a comment or reply, invalidate the post cache
    else if (postId) {
      postCache.delete(`post-${postId}`);
    }
    
    return !isLiked;
  } catch (error) {
    console.error(`Error toggling like for ${type}:`, error);
    throw error;
  }
};
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
  Timestamp,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Assessment Functions
export const saveAssessment = async (userId: string, assessmentData: any) => {
  try {
    // Create assessment document
    const assessmentRef = await addDoc(collection(db, 'assessments'), {
      user_id: userId,
      mbti_type: assessmentData.mbti_type,
      createdAt: serverTimestamp()
    });

    // Add answers as subcollection
    const answers = assessmentData.answers || [];
    await Promise.all(answers.map(async (answer: any) => {
      await addDoc(collection(db, 'assessments', assessmentRef.id, 'answers'), {
        question_id: answer.question_id,
        answer: answer.answer,
        createdAt: serverTimestamp()
      });
    }));

    return { data: { id: assessmentRef.id } };
  } catch (error) {
    console.error('Error saving assessment:', error);
    throw error;
  }
};

// Forum Functions
export const fetchPosts = async () => {
  try {
    const postsRef = collection(db, 'posts');
    
    // Calculate date 7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Create query for posts from the last week
    const q = query(
      postsRef,
      where('createdAt', '>=', Timestamp.fromDate(oneWeekAgo)),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    // Get all posts with their engagement metrics
    const posts = await Promise.all(querySnapshot.docs.map(async (postDoc) => {
      const data = postDoc.data();
      
      // Get comments count
      const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
      const commentsCount = commentsSnapshot.size;

      // Get likes count
      const likesSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'likes'));
      const likesCount = likesSnapshot.size;

      return {
        id: postDoc.id,
        ...data,
        comments_count: commentsCount || 0,
        likes_count: likesCount || 0,
        engagement_score: (likesCount || 0) + (commentsCount || 0) // Calculate engagement score
      };
    }));

    // Sort by engagement score and take top 5
    const sortedPosts = posts
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, 5);

    return { data: sortedPosts };
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};

export const fetchPost = async (postId: string) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const postData = postDoc.data();

    // Get comments
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const commentsSnapshot = await getDocs(query(commentsRef, orderBy('createdAt', 'desc')));
    
    const comments = await Promise.all(commentsSnapshot.docs.map(async commentDoc => {
      const commentData = commentDoc.data();
      
      // Get replies for each comment
      const repliesRef = collection(db, 'posts', postId, 'comments', commentDoc.id, 'replies');
      const repliesSnapshot = await getDocs(query(repliesRef, orderBy('createdAt', 'desc')));
      
      // Get comment likes
      const commentLikesSnapshot = await getDocs(collection(db, 'posts', postId, 'comments', commentDoc.id, 'likes'));
      
      const replies = await Promise.all(repliesSnapshot.docs.map(async replyDoc => {
        const replyData = replyDoc.data();
        // Get reply likes
        const replyLikesSnapshot = await getDocs(
          collection(db, 'posts', postId, 'comments', commentDoc.id, 'replies', replyDoc.id, 'likes')
        );

        return {
          id: replyDoc.id,
          content: replyData.content || '',
          user_id: replyData.userId || '',
          user_name: replyData.user_name || '',
          likes_count: replyLikesSnapshot.size || 0,
          created_at: replyData.createdAt || null
        };
      }));

      return {
        id: commentDoc.id,
        content: commentData.content || '',
        user_id: commentData.userId || '',
        user_name: commentData.user_name || '',
        likes_count: commentLikesSnapshot.size || 0,
        created_at: commentData.createdAt || null,
        replies
      };
    }));

    // Get post likes
    const likesSnapshot = await getDocs(collection(db, 'posts', postId, 'likes'));

    const post = {
      id: postDoc.id,
      title: postData.title || '',
      content: postData.content || '',
      category: postData.category || '',
      image_url: postData.image_url || '',
      video_url: postData.video_url || '',
      user_id: postData.userId || '',
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
};

export const createPost = async (userId: string, userName: string, title: string, content: string, category: string, imageUrl?: string, videoUrl?: string) => {
  try {
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

    return { data: { id: postRef.id } };
  } catch (error) {
    console.error('Error creating post:', error);
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

    return { data: { id: commentRef.id } };
  } catch (error) {
    console.error('Error creating comment:', error);
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

    return { data: { id: replyRef.id } };
  } catch (error) {
    console.error('Error creating reply:', error);
    throw error;
  }
};

export const toggleLike = async (type: 'post' | 'comment' | 'reply', id: string, userId: string) => {
  try {
    const likesRef = collection(db, `${type}s`, id, 'likes');
    const userLikeQuery = query(likesRef, where('userId', '==', userId));
    const userLikeSnapshot = await getDocs(userLikeQuery);

    if (userLikeSnapshot.empty) {
      // Add like
      await addDoc(likesRef, {
        userId,
        createdAt: serverTimestamp()
      });
      return true;
    } else {
      // Remove like
      await deleteDoc(userLikeSnapshot.docs[0].ref);
      return false;
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};
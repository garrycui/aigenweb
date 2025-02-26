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
  arrayUnion,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';

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

    return { data: { id: assessmentRef.id } };
  } catch (error) {
    console.error('Error saving assessment:', error);
    throw error;
  }
};

export const getLatestAssessment = async (userId: string) => {
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
};

// Forum Functions
export const fetchPosts = async (
  sortBy: 'date' | 'likes' | 'comments' = 'date',
  page: number = 1
) => {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef);
    const querySnapshot = await getDocs(q);

    const posts = await Promise.all(querySnapshot.docs.map(async (postDoc) => {
      const data = postDoc.data();
      const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
      const commentsCount = commentsSnapshot.size;
      const likesSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'likes'));
      const likesCount = likesSnapshot.size;
      return {
        id: postDoc.id,
        ...data,
        comments_count: commentsCount || 0,
        likes_count: likesCount || 0,
        engagement_score: (likesCount || 0) + (commentsCount || 0),
        createdAt: data.createdAt || null
      };
    }));

    let sortedPosts = posts;
    if (sortBy === 'date') {
      sortedPosts = posts.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
    } else if (sortBy === 'likes') {
      sortedPosts = posts.sort((a, b) => b.likes_count - a.likes_count);
    } else if (sortBy === 'comments') {
      sortedPosts = posts.sort((a, b) => b.comments_count - a.comments_count);
    }

    const start = (page - 1) * 10;
    const pagedPosts = sortedPosts.slice(start, start + 10);
    return { data: pagedPosts };
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

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        publishedPosts: [postRef.id]
      });
    } else {
      await updateDoc(userRef, {
        publishedPosts: arrayUnion(postRef.id)
      });
    }

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

    // Remove post ID from user's publishedPosts array
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const publishedPosts = userDoc.data().publishedPosts || [];
      await updateDoc(userRef, {
        publishedPosts: publishedPosts.filter((id: string) => id !== postId)
      });
    }

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

    return { data: { id: commentRef.id } };
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

    return { success: true };
  } catch (error) {
    console.error('Error deleting reply:', error);
    throw error;
  }
};

export const toggleLike = async (type: 'post' | 'comment' | 'reply', id: string, userId: string) => {
  try {
    const likesRef = collection(db, `${type}s`, id, 'likes');
    const userLikeQuery = query(likesRef, where('userId', '==', userId));
    const userLikeSnapshot = await getDocs(userLikeQuery);

    if (userLikeSnapshot.empty) {
      await addDoc(likesRef, {
        userId,
        createdAt: serverTimestamp()
      });
      return true;
    } else {
      await deleteDoc(userLikeSnapshot.docs[0].ref);
      return false;
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

export const searchPosts = async (
  searchQuery: string,
  sortBy: 'date' | 'likes' | 'comments' = 'date',
  page: number = 1
) => {
  try {
    const postsRef = collection(db, 'posts');
    const constraints: any[] = [];
    constraints.push(orderBy(sortBy === 'date' ? 'createdAt' : sortBy, 'desc'));
    const q = query(postsRef, ...constraints);
    const querySnapshot = await getDocs(q);

    let posts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as {
      id: string;
      title: string;
      content: string;
      category: string;
      image_url?: string;
      video_url?: string;
      userId: string;
      user_name: string;
      likes_count: number;
      comments_count: number;
      createdAt: any;
    }[];

    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      posts = posts.filter(post =>
        post.title.toLowerCase().includes(queryLower) ||
        post.content.toLowerCase().includes(queryLower) ||
        post.category.toLowerCase().includes(queryLower)
      );
    }

    if (sortBy === 'date') {
      posts = posts.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
    } else if (sortBy === 'likes') {
      posts = posts.sort((a, b) => b.likes_count - a.likes_count);
    } else if (sortBy === 'comments') {
      posts = posts.sort((a, b) => b.comments_count - a.comments_count);
    }

    const start = (page - 1) * 10;
    const pagedPosts = posts.slice(start, start + 10);
    return { data: pagedPosts };
  } catch (error) {
    console.error('Error searching posts:', error);
    throw error;
  }
};
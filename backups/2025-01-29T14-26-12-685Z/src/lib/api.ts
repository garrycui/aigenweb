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
  increment,
  serverTimestamp,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

// Forum Functions
export const fetchPosts = async () => {
  try {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const posts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { data: posts };
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

    // Get comments
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const commentsSnapshot = await getDocs(query(commentsRef, orderBy('created_at', 'desc')));
    
    const comments = await Promise.all(commentsSnapshot.docs.map(async commentDoc => {
      // Get replies for each comment
      const repliesRef = collection(db, 'posts', postId, 'comments', commentDoc.id, 'replies');
      const repliesSnapshot = await getDocs(query(repliesRef, orderBy('created_at', 'desc')));
      
      const replies = repliesSnapshot.docs.map(replyDoc => ({
        id: replyDoc.id,
        ...replyDoc.data()
      }));

      return {
        id: commentDoc.id,
        ...commentDoc.data(),
        replies
      };
    }));

    const post = {
      id: postDoc.id,
      ...postDoc.data(),
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
      user_id: userId,
      user_name: userName,
      title,
      content,
      category,
      image_url: imageUrl,
      video_url: videoUrl,
      likes_count: 0,
      comments_count: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
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
      user_id: userId,
      user_name: userName,
      content,
      likes_count: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    // Update post comments count
    await updateDoc(doc(db, 'posts', postId), {
      comments_count: increment(1)
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
        user_id: userId,
        user_name: userName,
        content,
        likes_count: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
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
    const userLikeQuery = query(likesRef, where('user_id', '==', userId));
    const userLikeSnapshot = await getDocs(userLikeQuery);

    if (userLikeSnapshot.empty) {
      // Add like
      await addDoc(likesRef, {
        user_id: userId,
        created_at: serverTimestamp()
      });

      await updateDoc(doc(db, `${type}s`, id), {
        likes_count: increment(1)
      });

      return true;
    } else {
      // Remove like
      await deleteDoc(userLikeSnapshot.docs[0].ref);

      await updateDoc(doc(db, `${type}s`, id), {
        likes_count: increment(-1)
      });

      return false;
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

// Assessment Functions
export const saveAssessment = async (userId: string, assessmentData: any) => {
  try {
    // Create assessment document
    const assessmentRef = await addDoc(collection(db, 'assessments'), {
      user_id: userId,
      mbti_type: assessmentData.mbti_type,
      created_at: serverTimestamp()
    });

    // Add answers as subcollection
    const answers = assessmentData.answers || [];
    await Promise.all(answers.map(async (answer: any) => {
      await addDoc(collection(db, 'assessments', assessmentRef.id, 'answers'), {
        question_id: answer.question_id,
        answer: answer.answer,
        created_at: serverTimestamp()
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
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { data: null };
    }

    const assessmentDoc = querySnapshot.docs[0];
    const answersRef = collection(db, 'assessments', assessmentDoc.id, 'answers');
    const answersSnapshot = await getDocs(answersRef);

    const assessment = {
      id: assessmentDoc.id,
      ...assessmentDoc.data(),
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
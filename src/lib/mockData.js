import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from './firebase.js';

// Mock user data
const mockUsers = [
  { email: 'sarah.chen@example.com', name: 'Sarah Chen', password: 'mockuser123' },
  { email: 'michael.rodriguez@example.com', name: 'Michael Rodriguez', password: 'mockuser123' },
  { email: 'emma.watson@example.com', name: 'Emma Watson', password: 'mockuser123' },
  { email: 'david.kim@example.com', name: 'David Kim', password: 'mockuser123' },
  { email: 'lisa.wang@example.com', name: 'Lisa Wang', password: 'mockuser123' }
];

// Mock forum posts
const mockPosts = [
  {
    title: "How I leveraged AI to improve my productivity by 50%",
    content: "Over the past six months, I've integrated various AI tools into my daily workflow, and the results have been remarkable. Here's my detailed journey:\n\n1. Email Management: Using AI to categorize and draft responses has saved me 2 hours daily\n2. Meeting Summaries: AI transcription and summarization tools ensure I never miss key points\n3. Code Assistance: AI pair programming has accelerated my development speed\n4. Document Analysis: AI helps me extract insights from lengthy reports in minutes\n\nThe key was gradual integration and constant evaluation of what works best for my specific needs.",
    category: "Success Stories",
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Dealing with AI anxiety in the workplace",
    content: "Many of us face anxiety about AI replacing our jobs. Here's how I transformed that fear into an opportunity for growth: 1) Identify AI-resistant skills, 2) Learn to collaborate with AI tools, 3) Focus on human-centric aspects of your role. Remember, AI is a tool to enhance our capabilities, not replace human creativity and emotional intelligence.",
    category: "Discussion",
    video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
];

// Mock comments for each post
const mockComments = [
  {
    content: "This is exactly what I needed! Could you share more details about the AI scheduling assistant you mentioned?",
    replies: [
      {
        content: "I use Calendar.ai - it's been a game changer for meeting scheduling. Happy to share my setup!"
      }
    ]
  },
  {
    content: "Thank you for sharing this! The gradual adoption approach really resonates with me.",
    replies: []
  }
];

export const createMockData = async () => {
  try {
    console.log('Creating mock users...');
    const createdUsers = await Promise.all(
      mockUsers.map(async (user) => {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
          
          // Update user profile with name
          await updateProfile(userCredential.user, {
            displayName: user.name
          });
          
          return {
            uid: userCredential.user.uid,
            ...user
          };
        } catch (error) {
          if (error.code === 'auth/email-already-in-use') {
            console.log(`User ${user.email} already exists`);
            return null;
          }
          throw error;
        }
      })
    );

    const validUsers = createdUsers.filter(user => user !== null);
    
    console.log('Creating mock posts...');
    await Promise.all(
      mockPosts.map(async (post, index) => {
        const user = validUsers[index % validUsers.length];
        if (!user) return;

        const postRef = await addDoc(collection(db, 'posts'), {
          user_id: user.uid,
          user_name: user.name,
          ...post,
          likes_count: Math.floor(Math.random() * 30),
          comments_count: mockComments.length,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });

        // Add comments
        await Promise.all(
          mockComments.map(async (comment, commentIndex) => {
            const commentUser = validUsers[(index + commentIndex + 1) % validUsers.length];
            if (!commentUser) return;

            const commentRef = await addDoc(collection(db, 'posts', postRef.id, 'comments'), {
              user_id: commentUser.uid,
              user_name: commentUser.name,
              content: comment.content,
              likes_count: Math.floor(Math.random() * 10),
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            });

            // Add replies
            await Promise.all(
              comment.replies.map(async (reply) => {
                const replyUser = validUsers[(index + commentIndex + 2) % validUsers.length];
                if (!replyUser) return;

                await addDoc(collection(db, 'posts', postRef.id, 'comments', commentRef.id, 'replies'), {
                  user_id: replyUser.uid,
                  user_name: replyUser.name,
                  content: reply.content,
                  likes_count: Math.floor(Math.random() * 5),
                  created_at: serverTimestamp(),
                  updated_at: serverTimestamp()
                });
              })
            );
          })
        );
      })
    );

    console.log('Mock data created successfully!');
  } catch (error) {
    console.error('Error creating mock data:', error);
    throw error;
  }
};
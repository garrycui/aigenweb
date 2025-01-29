import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from './firebase';

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
  },
  {
    title: "Essential AI tools every professional should know",
    content: "After testing dozens of AI tools, here are the ones that have become indispensable in my workflow: 1) ChatGPT for brainstorming and writing assistance, 2) Notion AI for document organization, 3) Otter.ai for meeting transcription, 4) Copy.ai for marketing content. I'll share my best practices for each tool.",
    category: "Tips & Tricks",
    image_url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "From skeptic to advocate: My AI adaptation journey",
    content: "A year ago, I was highly skeptical of AI tools. Today, I can't imagine working without them. Here's my transformation story and the key lessons learned about embracing technological change while maintaining a critical perspective.",
    category: "Success Stories"
  },
  {
    title: "Building an AI-friendly company culture",
    content: "As a team leader, I've learned that successful AI adoption starts with culture. Here's our framework for creating an environment where both employees and AI can thrive: 1) Open dialogue about AI, 2) Clear guidelines for AI use, 3) Regular training sessions, 4) Celebrating AI-human collaboration successes.",
    category: "Case Studies",
    image_url: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Overcoming initial AI learning curves",
    content: "The first few weeks of adopting AI tools can be challenging. Here are practical strategies that helped me and my team get past the initial hurdles and start seeing real benefits from AI integration.",
    category: "Tips & Tricks"
  },
  {
    title: "AI ethics in daily professional practice",
    content: "As AI becomes more integrated into our work, we need to consider ethical implications. Here's my practical guide to ensuring responsible AI use in daily tasks, including data privacy, bias awareness, and transparency.",
    category: "Discussion",
    image_url: "https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Measuring ROI on AI tool investments",
    content: "How do you justify AI tool investments? I've developed a framework for measuring both quantitative and qualitative returns on AI investments, including productivity gains, error reduction, and employee satisfaction.",
    category: "Case Studies"
  },
  {
    title: "AI-powered customer service transformation",
    content: "Our customer service team achieved a 40% reduction in response time while improving satisfaction scores. Here's our detailed implementation strategy and lessons learned.",
    category: "Success Stories",
    image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "The human skills that AI can't replace",
    content: "While AI capabilities grow, certain human skills become even more valuable. Here's my analysis of the most important skills to develop for the AI age, based on my experience leading digital transformation projects.",
    category: "Discussion"
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
  },
  {
    content: "Great insights! How long did it take to see measurable improvements?",
    replies: [
      {
        content: "It took about 2-3 weeks to see the first improvements, and about 2 months to reach the 50% mark."
      }
    ]
  }
];

export const createMockData = async () => {
  try {
    console.log('Creating mock users...');
    const createdUsers = await Promise.all(
      mockUsers.map(async (user) => {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
          return {
            uid: userCredential.user.uid,
            ...user
          };
        } catch (error: any) {
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
import { addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';

// Mock user data
const mockUsers = [
  { email: 'sarah.chen@example.com', name: 'Sarah Chen', password: 'mockuser123' },
  { email: 'michael.rodriguez@example.com', name: 'Michael Rodriguez', password: 'mockuser123' },
  { email: 'emma.watson@example.com', name: 'Emma Watson', password: 'mockuser123' },
  { email: 'david.kim@example.com', name: 'David Kim', password: 'mockuser123' },
  { email: 'lisa.wang@example.com', name: 'Lisa Wang', password: 'mockuser123' },
  { email: 'john.doe@example.com', name: 'John Doe', password: 'mockuser123' },
  { email: 'jane.doe@example.com', name: 'Jane Doe', password: 'mockuser123' },
  { email: 'alice.smith@example.com', name: 'Alice Smith', password: 'mockuser123' },
  { email: 'bob.jones@example.com', name: 'Bob Jones', password: 'mockuser123' },
  { email: 'charlie.brown@example.com', name: 'Charlie Brown', password: 'mockuser123' }
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
    category: "Mental Health",
    image_url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Top 5 AI tools for learning and development",
    content: "AI is revolutionizing the way we learn and develop new skills. Here are the top 5 AI tools that can help you stay ahead:\n\n1. Duolingo: AI-powered language learning\n2. Coursera: Personalized course recommendations\n3. Grammarly: AI writing assistant\n4. Khan Academy: Adaptive learning platform\n5. LinkedIn Learning: Skill assessments and personalized learning paths",
    category: "Learning",
    image_url: "https://images.unsplash.com/photo-1581091870622-1c6baca6a7e7?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "How AI is transforming customer support",
    content: "AI is making customer support more efficient and effective. Here's how:\n\n1. Chatbots: Providing instant responses to common queries\n2. Sentiment Analysis: Understanding customer emotions\n3. Predictive Analytics: Anticipating customer needs\n4. Automated Ticketing: Streamlining support processes\n5. Virtual Assistants: Offering personalized support",
    category: "Support Stories",
    image_url: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "The latest advancements in Generative AI",
    content: "Generative AI is evolving rapidly. Here are the latest advancements:\n\n1. GPT-4: Improved language understanding and generation\n2. DALL-E: Creating images from textual descriptions\n3. Codex: AI-powered code generation\n4. MusicLM: Generating music from text prompts\n5. StyleGAN3: High-quality image synthesis",
    category: "Latest News",
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "AI in healthcare: Transforming patient care",
    content: "AI is revolutionizing healthcare. Here's how:\n\n1. Predictive Analytics: Identifying potential health risks\n2. Personalized Treatment: Tailoring treatments to individual patients\n3. Medical Imaging: Enhancing diagnostic accuracy\n4. Virtual Health Assistants: Providing 24/7 support\n5. Drug Discovery: Accelerating the development of new medications",
    category: "Support Stories",
    image_url: "https://images.unsplash.com/photo-1581091870622-1c6baca6a7e7?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "AI for social good: Making a positive impact",
    content: "AI is being used to address some of the world's biggest challenges. Here are a few examples:\n\n1. Climate Change: Predicting and mitigating environmental impacts\n2. Education: Providing personalized learning experiences\n3. Healthcare: Improving patient outcomes\n4. Accessibility: Enhancing the lives of people with disabilities\n5. Disaster Response: Coordinating relief efforts",
    category: "Support Stories",
    image_url: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "How to get started with Generative AI",
    content: "Interested in exploring Generative AI? Here's how to get started:\n\n1. Learn the basics: Understand the fundamentals of AI and machine learning\n2. Explore tools: Experiment with tools like GPT-3, DALL-E, and Codex\n3. Build projects: Create your own AI-generated content\n4. Join communities: Connect with other AI enthusiasts\n5. Stay updated: Keep up with the latest advancements in Generative AI",
    category: "Learning",
    image_url: "https://images.unsplash.com/photo-1581091870622-1c6baca6a7e7?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "AI in finance: Enhancing decision-making",
    content: "AI is transforming the finance industry. Here's how:\n\n1. Fraud Detection: Identifying fraudulent activities\n2. Risk Management: Assessing and mitigating risks\n3. Algorithmic Trading: Optimizing trading strategies\n4. Customer Insights: Understanding customer behavior\n5. Financial Planning: Providing personalized financial advice",
    category: "Latest News",
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "The future of AI: What to expect in the next decade",
    content: "AI is poised to revolutionize many aspects of our lives. Here's what to expect in the next decade:\n\n1. Autonomous Vehicles: Self-driving cars becoming mainstream\n2. AI in Healthcare: Advanced diagnostics and personalized treatments\n3. Smart Cities: AI-powered urban planning and management\n4. AI in Education: Personalized learning experiences\n5. Ethical AI: Addressing the ethical implications of AI",
    category: "Latest News",
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
  }
];

export async function createMockData(db, auth) {
  try {
    console.log('Creating mock users...');
    const userCredentials = [];

    // Create mock users
    for (const user of mockUsers) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        await updateProfile(userCredential.user, { displayName: user.name });
        console.log(`Created user: ${user.email}`);
        userCredentials.push(userCredential);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`User already exists: ${user.email}`);
          const userCredential = await signInWithEmailAndPassword(auth, user.email, user.password);
          userCredentials.push(userCredential);
        } else {
          throw error;
        }
      }
    }

    console.log('Creating mock posts...');
    // Create mock posts
    for (let i = 0; i < mockPosts.length; i++) {
      const post = mockPosts[i];
      const userCredential = userCredentials[i % userCredentials.length]; // Associate each post with a user

      // Check if a post with the same title already exists
      const q = query(collection(db, 'posts'), where('title', '==', post.title));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // If post exists, update it
        const existingPostDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'posts', existingPostDoc.id), {
          ...post,
          userId: userCredential.user.uid,
          updatedAt: serverTimestamp()
        });
        console.log(`Updated post: ${post.title} by user: ${userCredential.user.email}`);
      } else {
        // If post does not exist, create a new one
        await addDoc(collection(db, 'posts'), {
          ...post,
          userId: userCredential.user.uid,
          createdAt: serverTimestamp()
        });
        console.log(`Created post: ${post.title} by user: ${userCredential.user.email}`);
      }
    }
  } catch (error) {
    console.error('Error creating mock data:', error);
  }
}
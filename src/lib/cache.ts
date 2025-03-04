import { db } from './firebase';
import { 
  doc, getDoc, updateDoc, setDoc, deleteDoc, collection, 
  getDocs, query, orderBy, onSnapshot, Unsubscribe 
} from 'firebase/firestore';

/**
 * A generic in-memory cache implementation with Time-To-Live (TTL) support
 */
export class Cache<T> {
  private cache: Map<string, { value: T; expiry: number }>;
  private defaultTTL: number;
  private maxSize: number;

  /**
   * Create a new cache instance
   * @param defaultTTL Default time-to-live in milliseconds
   * @param maxSize Maximum number of items in the cache
   */
  constructor(defaultTTL = 5 * 60 * 1000, maxSize = 100) { // Default 5 minutes
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to store
   * @param ttl Time-to-live in milliseconds (optional)
   */
  set(key: string, value: T, ttl?: number): void {
    // Don't store null or undefined values
    if (value === null || value === undefined) {
      console.warn(`Attempted to cache null/undefined value for key: ${key}`);
      return;
    }
    
    // Deep clone objects to prevent reference issues
    const clonedValue = this.cloneValue(value);
    const expiry = Date.now() + (ttl || this.defaultTTL);
    
    // Check if we need to remove old items
    if (this.cache.size >= this.maxSize) {
      this.removeOldestItem();
    }
    
    this.cache.set(key, { value: clonedValue, expiry });
  }

  /**
   * Create a deep clone of a value to prevent reference issues
   * @param value Value to clone
   * @returns Cloned value
   */
  private cloneValue(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    try {
      // Handle Date objects specially
      if (value instanceof Date) {
        return new Date(value.getTime()) as unknown as T;
      }
      
      // For regular objects, use JSON stringify/parse for deep cloning
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      console.warn('Failed to clone cached value, using original reference', err);
      return value;
    }
  }

  /**
   * Remove the oldest item from the cache
   */
  private removeOldestItem(): void {
    // Find the item with the earliest expiry time
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < oldestExpiry) {
        oldestKey = key;
        oldestExpiry = item.expiry;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    
    // Return undefined if item doesn't exist or has expired
    if (!item || item.expiry < Date.now()) {
      if (item) this.cache.delete(key); // Clean up expired item
      return undefined;
    }
    
    return item.value;
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item || item.expiry < Date.now()) {
      if (item) this.cache.delete(key); // Clean up expired item
      return false;
    }
    return true;
  }

  /**
   * Delete a key from the cache
   * @param key Cache key
   * @returns True if the key was deleted
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set a value in the cache
   * @param key Cache key
   * @param fetchFn Function to fetch the value if not in cache
   * @param ttl Time-to-live in milliseconds (optional)
   * @returns The cached or fetched value
   */
  async getOrSet(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    const cachedValue = this.get(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    const value = await fetchFn();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Remove all expired items from the cache
   * @returns Number of items removed
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get the number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   * @returns Array of all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Create and export default cache instances with different TTLs
export const userCache = new Cache<any>(10 * 60 * 1000, 200);     // 10 minutes
export const tutorialCache = new Cache<any>(30 * 60 * 1000, 100); // 30 minutes
export const forumCache = new Cache<any>(5 * 60 * 1000, 50);     // 5 minutes
export const postCache = new Cache<any>(2 * 60 * 1000, 50);      // 2 minutes
export const sessionCache = new Cache<any>(5 * 60 * 1000, 20);   // 5 minutes
export const assessmentCache = new Cache<any>(60 * 60 * 1000, 10); // 1 hour - longer TTL for stable assessment data

// Helper function to create a user cache key
export const getUserCacheKey = (userId: string) => `user-${userId}`;

// Function to invalidate user cache
export const invalidateUserCache = (userId?: string) => {
  if (userId) {
    // Clear specific user cache entries
    userCache.delete(getUserCacheKey(userId));
    userCache.delete(`user-profile-${userId}`);
    console.log(`User cache invalidated for: ${userId}`);
    return true;
  }
  
  // If no userId provided, clear all user cache entries
  const userCacheKeys = userCache.keys().filter(key => 
    key.startsWith('user-') || key.startsWith('user-profile-')
  );
  
  userCacheKeys.forEach(key => userCache.delete(key));
  console.log(`Invalidated ${userCacheKeys.length} user cache entries`);
  return userCacheKeys.length > 0;
};

// Define subscription fields to be monitored
export const SUBSCRIPTION_FIELDS = [
  'subscriptionStatus',
  'subscriptionPlan',
  'subscriptionStart',
  'subscriptionEnd',
  'isTrialing',
  'cancelAtPeriodEnd',
  'trialEndsAt',
  'stripeCustomerId',
  'stripeSubscriptionId'
];

// Store active subscription listeners
const activeSubscriptionListeners = new Map<string, {
  unsubscribe: Unsubscribe;
  callbacks: Set<(data: Record<string, any>) => void>;
}>();

/**
 * Get user data with subscription listener automatically set up
 * @param userId User ID
 * @param onSubscriptionUpdate Optional callback for subscription updates
 * @returns User data object or null if not found
 */
export const getUserWithSubscription = async (
  userId: string,
  onSubscriptionUpdate?: (data: Record<string, any>) => void
) => {
  if (!userId) return null;
  
  // Get initial user data
  const userData = await getUser(userId);
  
  if (userData && onSubscriptionUpdate) {
    // Register the callback for subscription updates
    addSubscriptionCallback(userId, onSubscriptionUpdate);
  }
  
  return userData;
};

/**
 * Add a callback for subscription updates, setting up a listener if needed
 * @param userId User ID
 * @param callback Function to call when subscription data changes
 */
export const addSubscriptionCallback = (
  userId: string,
  callback: (data: Record<string, any>) => void
): void => {
  // Add debounce for rapid updates
  let pendingUpdate = false;
  let latestData: Record<string, any> | null = null;
  
  const debouncedCallback = (data: Record<string, any>) => {
    latestData = data;
    
    if (!pendingUpdate) {
      pendingUpdate = true;
      setTimeout(() => {
        if (latestData) {
          callback(latestData);
        }
        pendingUpdate = false;
        latestData = null;
      }, 50); // Short delay to batch rapid updates
    }
  };

  // If we already have a listener for this user
  if (activeSubscriptionListeners.has(userId)) {
    // Just add the new callback
    activeSubscriptionListeners.get(userId)!.callbacks.add(debouncedCallback);
    return;
  }
  
  // Otherwise set up a new listener
  const userRef = doc(db, 'users', userId);
  const unsubscribe = onSnapshot(
    userRef,
    {
      next: (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data() as Record<string, any>;
          const subscriptionData: Record<string, any> = {};
          
          // Extract only subscription-related fields
          SUBSCRIPTION_FIELDS.forEach(field => {
            if (field in userData) {
              // Convert timestamps to dates
              if (userData[field]?.toDate) {
                subscriptionData[field] = userData[field].toDate();
              } else {
                subscriptionData[field] = userData[field];
              }
            }
          });
          
          // Update cache with the new subscription data
          const cacheKey = getUserCacheKey(userId);
          const cachedUser = userCache.get(cacheKey);
          
          if (cachedUser) {
            // Properly merge cached data with new subscription data
            const mergedData = {
              ...cachedUser,
              ...subscriptionData
            };
            
            // Update the cache with merged data
            userCache.set(cacheKey, mergedData);
            
            // Also invalidate any related cache entries
            invalidateRelatedUserCacheEntries(userId);
          }
          
          // Call all registered callbacks
          const listenerData = activeSubscriptionListeners.get(userId);
          if (listenerData) {
            listenerData.callbacks.forEach(cb => cb(subscriptionData));
          }
        }
      },
      error: (error) => {
        console.error('Error in subscription listener:', error);
        
        // Try to reconnect after a delay if this was a temporary error
        setTimeout(() => {
          console.log('Attempting to reconnect subscription listener...');
          
          // Remove the broken listener
          const listenerData = activeSubscriptionListeners.get(userId);
          if (listenerData) {
            activeSubscriptionListeners.delete(userId);
            
            // Re-establish the listener with the same callback
            if (listenerData.callbacks.size > 0) {
              listenerData.callbacks.forEach(cb => {
                addSubscriptionCallback(userId, cb);
              });
            }
          }
        }, 10000); // Try again after 10 seconds
      }
    }
  );
  
  // Store the unsubscribe function and callbacks set
  activeSubscriptionListeners.set(userId, {
    unsubscribe,
    callbacks: new Set([debouncedCallback])
  });
};

/**
 * Remove a specific callback for subscription updates
 * @param userId User ID
 * @param callback The callback function to remove
 * @returns True if the callback was removed
 */
export const removeSubscriptionCallback = (
  userId: string,
  callback: (data: Record<string, any>) => void
): boolean => {
  const listenerData = activeSubscriptionListeners.get(userId);
  if (!listenerData) return false;
  
  // Remove the callback
  listenerData.callbacks.delete(callback);
  
  // If no more callbacks, remove the entire listener
  if (listenerData.callbacks.size === 0) {
    listenerData.unsubscribe();
    activeSubscriptionListeners.delete(userId);
  }
  
  return true;
};

/**
 * Clean up all subscription listeners
 */
export const cleanupAllSubscriptionListeners = (): void => {
  activeSubscriptionListeners.forEach(({ unsubscribe }) => unsubscribe());
  activeSubscriptionListeners.clear();
};

// ===== User Data Service =====

/**
 * Get user data from cache or Firestore
 * @param userId User ID
 * @returns User data object or null if not found
 */
export const getUser = async (userId: string) => {
  if (!userId) return null;
  
  const cacheKey = getUserCacheKey(userId);
  
  return userCache.getOrSet(cacheKey, async () => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return null;
      
      // Convert Firestore timestamp to JS Date
      const userData = userDoc.data() as Record<string, any>;
      
      // Expand the list of timestamp fields to handle all potential dates
      const timestampFields = [
        'createdAt', 'updatedAt', 'lastActivityAt', 'lastReviewedAt',
        'subscriptionStart', 'subscriptionEnd', 'trialEndsAt',
        'reviewDismissedAt', 'lastLoginAt', 'paymentDueDate',
        'nextBillingDate'
      ];
      
      for (const field of timestampFields) {
        if (userData[field]?.toDate) {
          userData[field] = userData[field].toDate();
        }
      }
      
      return {
        id: userId,
        ...userData
      } as Record<string, any>;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  });
};

/**
 * Update user data in Firestore and invalidate cache
 * @param userId User ID
 * @param userData Partial user data to update
 * @returns Updated user data
 */
export const updateUser = async (userId: string, userData: Record<string, any>) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // First, get the current data from Firestore
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${userId} does not exist`);
    }
    
    // Add updated timestamp
    const updateData = {
      ...userData,
      updatedAt: new Date()
    };
    
    // Update in Firestore
    await updateDoc(userRef, updateData);
    
    // Get the full user data after update to ensure cache is complete
    const updatedUserDoc = await getDoc(userRef);
    const fullUserData = {
      id: userId,
      ...updatedUserDoc.data()
    } as Record<string, any>;
    
    // Convert any timestamps in the response
    const timestampFields = [
      'createdAt', 'updatedAt', 'lastActivityAt', 'lastReviewedAt',
      'subscriptionStart', 'subscriptionEnd', 'trialEndsAt'
    ];
    
    for (const field of timestampFields) {
      if (fullUserData[field]?.toDate) {
        fullUserData[field] = fullUserData[field].toDate();
      }
    }
    
    // Update the cache with complete data
    userCache.set(getUserCacheKey(userId), fullUserData);
    
    // Return the updated user data
    return fullUserData;
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
};

/**
 * Create new user in Firestore
 * @param userId User ID
 * @param userData User data
 * @returns Created user data
 */
export const createUser = async (userId: string, userData: Record<string, any>) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Return the new user data
    return getUser(userId);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Delete user from Firestore and clear cache
 * @param userId User ID
 * @returns Success boolean
 */
export const deleteUser = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    
    // Clear from cache
    invalidateUserCache(userId);
    
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Get a specific field from user data
 * @param userId User ID
 * @param field Field name
 * @returns Field value or null if not found
 */
export const getUserField = async (userId: string, field: string) => {
  const userData = await getUser(userId);
  return userData ? userData[field] : null;
};

/**
 * Update a specific field in user data
 * @param userId User ID
 * @param field Field name
 * @param value New value
 * @returns Updated user data
 */
export const updateUserField = async (userId: string, field: string, value: any) => {
  const updateData = { [field]: value };
  return updateUser(userId, updateData);
};

// ===== User Subcollection Data Service =====

/**
 * Get a document from a user's subcollection
 * @param userId User ID
 * @param subcollection Subcollection name
 * @param docId Document ID
 * @returns Document data or empty object with default structure if not found
 */
export const getUserSubcollectionDoc = async (userId: string, subcollection: string, docId: string) => {
  if (!userId) {
    console.warn('getUserSubcollectionDoc called with no userId');
    return {};
  }
  
  const cacheKey = `user-${userId}-${subcollection}-${docId}`;
  
  return userCache.getOrSet(cacheKey, async () => {
    try {
      const docRef = doc(db, 'users', userId, subcollection, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docId,
          ...docSnap.data()
        };
      }
      
      // Return appropriate default structure based on the subcollection/document type
      if (subcollection === 'learningGoals' && docId === 'goals') {
        return { goals: [] };
      }
      
      // Default empty object for other subcollections
      return {};
    } catch (error) {
      console.error(`Error fetching ${subcollection}/${docId}:`, error);
      // Return an appropriate default structure rather than throwing
      if (subcollection === 'learningGoals' && docId === 'goals') {
        return { goals: [] };
      }
      return {};
    }
  });
};

/**
 * Update a document in a user's subcollection
 * @param userId User ID
 * @param subcollection Subcollection name
 * @param docId Document ID
 * @param data Data to update
 * @returns Updated document data
 */
export const updateUserSubcollectionDoc = async (
  userId: string, 
  subcollection: string, 
  docId: string, 
  data: Record<string, any>
) => {
  try {
    const docRef = doc(db, 'users', userId, subcollection, docId);
    
    // Check if document exists before updating
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, use updateDoc
      await updateDoc(docRef, data);
    } else {
      // Document doesn't exist, use setDoc instead
      await setDoc(docRef, {
        ...data,
        createdAt: new Date()
      });
    }
    
    // Invalidate specific cache entry
    userCache.delete(`user-${userId}-${subcollection}-${docId}`);
    
    // Return updated document data
    return getUserSubcollectionDoc(userId, subcollection, docId);
  } catch (error) {
    console.error(`Error updating ${subcollection} document:`, error);
    throw error;
  }
};

/**
 * Get all documents from a user's subcollection
 * @param userId User ID
 * @param subcollection Subcollection name
 * @param queryConstraints Optional query constraints (where, orderBy, etc.)
 * @returns Array of document data
 */
export const getUserSubcollection = async (
  userId: string, 
  subcollection: string,
  queryConstraints: any[] = []
) => {
  if (!userId) return [];
  
  const cacheKey = `user-${userId}-${subcollection}-list`;
  
  return userCache.getOrSet(cacheKey, async () => {
    try {
      const collRef = collection(db, 'users', userId, subcollection);
      const q = query(collRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error fetching ${subcollection} collection:`, error);
      throw error;
    }
  });
};

/**
 * Get user's learning goals from subcollection
 * @param userId User ID
 * @returns Learning goals data or null if not found
 */
export const getLearningGoals = async (userId: string) => {
  const goalsData = await getUserSubcollectionDoc(userId, 'learningGoals', 'goals');
  return goalsData?.goals || [];
};

/**
 * Update user's learning goals
 * @param userId User ID
 * @param goals Updated goals array
 * @returns Updated learning goals data
 */
export const updateLearningGoals = async (userId: string, goals: any[]) => {
  return updateUserSubcollectionDoc(userId, 'learningGoals', 'goals', { goals });
};

/**
 * Get user's mood entries from subcollection
 * @param userId User ID
 * @returns Array of mood entries
 */
export const getUserMoodEntries = async (userId: string, forceRefresh = false) => {
  // If not forcing refresh, check cache first
  if (!forceRefresh) {
    // Check cache logic here...
  }

  // If forcing refresh or not in cache, get from Firestore
  const moodEntriesRef = collection(db, 'users', userId, 'moodEntries');
  const q = query(moodEntriesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  const records = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Update cache with the new records
  // Cache update logic here...

  return records;
};

/**
 * Invalidate related user cache entries
 * @param userId User ID
 */
export const invalidateRelatedUserCacheEntries = (userId: string): void => {
  // Find and invalidate any cache entries that might depend on subscription data
  const relatedKeys = userCache.keys().filter(key => 
    key.startsWith(`user-${userId}-`) && 
    !key.endsWith('-list') // Don't invalidate collection lists
  );
  
  relatedKeys.forEach(key => userCache.delete(key));
};

// Set up automatic cache cleanup every 5 minutes
setInterval(() => {
  const userRemoved = userCache.cleanup();
  const tutorialRemoved = tutorialCache.cleanup();
  const forumRemoved = forumCache.cleanup();
  const postRemoved = postCache.cleanup();
  const sessionRemoved = sessionCache.cleanup();
  const assessmentRemoved = assessmentCache.cleanup();
  
  const totalRemoved = userRemoved + tutorialRemoved + forumRemoved + 
                       postRemoved + sessionRemoved + assessmentRemoved;
  
  if (totalRemoved > 0) {
    console.log(`Auto-cleanup removed ${totalRemoved} expired cache entries`);
  }
}, 5 * 60 * 1000);
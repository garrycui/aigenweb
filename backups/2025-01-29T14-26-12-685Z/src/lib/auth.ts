import { query } from './database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.VITE_JWT_SECRET || 'your-secret-key';

export const createUser = async (email: string, password: string, name: string) => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data, error } = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

    if (error) throw error;
    
    const token = jwt.sign({ userId: data[0].id }, JWT_SECRET);
    return { user: data[0], token, error: null };
  } catch (error) {
    return { user: null, token: null, error };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (error) throw error;
    if (!data?.length) {
      return { user: null, token: null, error: 'Invalid credentials' };
    }

    const user = data[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return { user: null, token: null, error: 'Invalid credentials' };
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    return { 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name 
      }, 
      token, 
      error: null 
    };
  } catch (error) {
    return { user: null, token: null, error };
  }
};

export const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, userId: (decoded as any).userId };
  } catch (error) {
    return { valid: false, userId: null };
  }
};
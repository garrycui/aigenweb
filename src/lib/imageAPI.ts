// imageAPI.ts
import axios from 'axios';
import { config } from 'dotenv';

config();

/**
 * Fetch images from the Pexels API based on a search query.
 * Returns an array of image URLs (using the "large2x" size for high quality).
 */
export const getPexelsImage = async (query: string): Promise<string[]> => {
  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      headers: {
        Authorization: process.env.VITE_PEXELS_API_KEY
      },
      params: {
        query: query,
        per_page: 5
      }
    });
    const photos = response.data.photos;
    const imageUrls = photos.map((photo: any) => photo.src.large2x);
    return imageUrls;
  } catch (error) {
    console.error('Error fetching Pexels images:', error);
    return [];
  }
};

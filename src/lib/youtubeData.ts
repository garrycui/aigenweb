import axios from 'axios';

export interface YouTubeVideo {
  title: string;
  url: string;
  snippet: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  videoId: string;
}

/**
 * Fetch videos from the YouTube Data API based on a search query.
 */
export async function fetchYouTubeVideos(query: string, maxResults = 5): Promise<YouTubeVideo[]> {
  try {
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 7);
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet` +
                      `&q=${encodeURIComponent(query)}` +
                      `&maxResults=${maxResults}` +
                      `&key=${process.env.YOUTUBE_API_KEY}` +
                      `&type=video` +
                      `&videoDuration=medium` +
                      `&videoEmbeddable=true` +
                      `&videoDefinition=high` +
                      `&publishedAfter=${publishedAfter.toISOString()}` +
                      `&relevanceLanguage=en`;
    
    const searchRes = await axios.get(searchUrl);
    const videoItems = searchRes.data.items.filter((item: any) => item.id.kind === 'youtube#video');
    const videoIds = videoItems.map((item: any) => item.id.videoId);
    if (videoIds.length === 0) return [];
    
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics` +
                     `&id=${videoIds.join(',')}` +
                     `&key=${process.env.YOUTUBE_API_KEY}`;
    
    const statsRes = await axios.get(statsUrl);
    const videos: YouTubeVideo[] = statsRes.data.items.map((item: any) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      snippet: item.snippet.description,
      viewCount: parseInt(item.statistics.viewCount, 10),
      likeCount: parseInt(item.statistics.likeCount || '0', 10),
      publishedAt: item.snippet.publishedAt,
      videoId: item.id
    }));
    return videos;
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return [];
  }
}

/**
 * Helper function to calculate the number of days since publication.
 */
function daysSince(publishedAt: string): number {
  const published = new Date(publishedAt);
  const now = new Date();
  return Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Rank videos using a quality score formula:
 * score = (viewCount * (likeCount + 1)) / (daysSince(publishedAt) + 1)
 */
export function rankVideos(videos: YouTubeVideo[]): YouTubeVideo[] {
  return videos.sort((a, b) => {
    const scoreA = (a.viewCount * (a.likeCount + 1)) / (daysSince(a.publishedAt) + 1);
    const scoreB = (b.viewCount * (b.likeCount + 1)) / (daysSince(b.publishedAt) + 1);
    return scoreB - scoreA;
  });
}

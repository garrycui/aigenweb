import { config } from 'dotenv';
import { createMockData } from '../src/lib/mockData.js';

// Load environment variables
config();

console.log('Starting to populate mock data...');
createMockData()
  .then(() => {
    console.log('Successfully populated mock data!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error populating mock data:', error);
    process.exit(1);
  });
import { createResource } from '../utils/track/createResource';

async function main() {
  try {
    console.time();
    await createResource('https://www.youtube.com/watch?v=0-yRE2_M78o');
    console.timeEnd();
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main().catch(console.error);

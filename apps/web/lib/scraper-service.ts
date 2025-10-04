/**
 * Restaurant Scraper Service
 * Communicates with the scraper API to scrape restaurant websites
 * and sync data to ElevenLabs knowledge base
 */

interface ScrapeResult {
  success: boolean;
  slug?: string;
  knowledgeBaseId?: string;
  message?: string;
  error?: string;
}

/**
 * Trigger scraping for a restaurant website
 * @param websiteUrl - The restaurant's website URL
 * @param restaurantName - The restaurant's name
 * @returns Promise with scrape result including slug and knowledge base ID
 */
export async function scrapeRestaurant(
  websiteUrl: string,
  restaurantName: string
): Promise<ScrapeResult> {
  try {
    const scraperApiUrl = process.env.SCRAPER_SERVICE_URL || 'http://localhost:4001';

    console.log(`🚀 Triggering scrape for: ${restaurantName} (${websiteUrl})`);

    const response = await fetch(`${scraperApiUrl}/api/scrape-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: websiteUrl,
        name: restaurantName,
        syncToElevenLabs: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Scraper API returned ${response.status}`);
    }

    const data = await response.json();

    console.log(`✅ Scrape triggered successfully for ${restaurantName}`);
    console.log(`   Slug: ${data.slug}`);

    return {
      success: true,
      slug: data.slug,
      message: data.message,
    };
  } catch (error) {
    console.error(`❌ Failed to scrape ${restaurantName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get knowledge base ID for a restaurant
 * This is set by the scraper after syncing to ElevenLabs
 * @param restaurantSlug - The restaurant's slug
 * @returns Promise with knowledge base ID or null
 */
export async function getKnowledgeBaseId(restaurantSlug: string): Promise<string | null> {
  try {
    const scraperApiUrl = process.env.SCRAPER_SERVICE_URL || 'http://localhost:4001';

    const response = await fetch(`${scraperApiUrl}/api/restaurant/${restaurantSlug}/info`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.knowledgeBaseId || null;
  } catch (error) {
    console.error(`Failed to get knowledge base ID for ${restaurantSlug}:`, error);
    return null;
  }
}

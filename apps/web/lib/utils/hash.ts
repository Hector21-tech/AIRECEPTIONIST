import crypto from 'crypto';

/**
 * Calculate SHA256 hash of text content
 * Used for detecting changes in scraped content
 *
 * @param text - Text content to hash
 * @returns SHA256 hash string (64 characters)
 */
export function calculateHash(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text.trim()) // Trim to avoid whitespace differences
    .digest('hex');
}

/**
 * Compare two hashes
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @returns true if hashes are equal
 */
export function hashesMatch(hash1: string | null, hash2: string | null): boolean {
  if (!hash1 || !hash2) return false;
  return hash1 === hash2;
}

/**
 * Check if content has changed by comparing hashes
 *
 * @param newContent - New content to check
 * @param oldHash - Previous hash to compare against
 * @returns true if content has changed
 */
export function hasContentChanged(newContent: string, oldHash: string | null): boolean {
  if (!oldHash) return true; // No previous hash = always changed

  const newHash = calculateHash(newContent);
  return !hashesMatch(newHash, oldHash);
}

/**
 * Blocklist helper functions for normalizing and matching artist names
 */

/**
 * Normalizes a string by trimming whitespace and converting to lowercase
 * @param {string} str - The string to normalize
 * @returns {string} - Normalized string
 */
function normalizeName(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.trim().toLowerCase();
}

/**
 * Sanitizes a blocklist array by removing blanks and deduplicating
 * @param {Array<string>} list - Array of artist names
 * @returns {Array<string>} - Sanitized array
 */
function sanitizeBlockedList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const normalized = list
    .map(normalizeName)
    .filter(name => name.length > 0);
  return [...new Set(normalized)]; // Remove duplicates
}

/**
 * Checks if an artist name matches any entry in the blocked list
 * Uses case-insensitive, trimmed exact match
 * @param {string} artistName - The artist name to check
 * @param {Array<string>} blockedArtists - Array of blocked artist names
 * @returns {boolean} - True if the artist is blocked
 */
function isBlockedArtist(artistName, blockedArtists) {
  if (!artistName || !Array.isArray(blockedArtists)) {
    return false;
  }
  
  const normalizedArtist = normalizeName(artistName);
  const normalizedBlocked = blockedArtists.map(normalizeName);
  
  return normalizedBlocked.includes(normalizedArtist);
}

/**
 * Checks if any artist in an array of artists is blocked
 * Useful for tracks with multiple artists
 * @param {Array<string>} artistNames - Array of artist names
 * @param {Array<string>} blockedArtists - Array of blocked artist names
 * @returns {boolean} - True if any artist is blocked
 */
function isAnyArtistBlocked(artistNames, blockedArtists) {
  if (!Array.isArray(artistNames)) {
    return false;
  }
  
  return artistNames.some(artist => isBlockedArtist(artist, blockedArtists));
}

module.exports = {
  normalizeName,
  sanitizeBlockedList,
  isBlockedArtist,
  isAnyArtistBlocked
};

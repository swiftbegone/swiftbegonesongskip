/**
 * Blocklist helper functions for normalizing and matching artist names and tracks
 */

/**
 * Normalizes a string by trimming whitespace, converting to lowercase, and collapsing whitespace
 * @param {string} str - The string to normalize
 * @returns {string} - Normalized string
 */
function normalize(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Keep normalizeName for backwards compatibility
const normalizeName = normalize;

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
    .map(normalize)
    .filter(name => name.length > 0);
  return [...new Set(normalized)]; // Remove duplicates
}

/**
 * Sanitizes a blocked tracks array by removing invalid entries and deduplicating
 * Artist is optional - if empty or missing, track will match any artist
 * @param {Array<{artist?: string, track: string}>} list - Array of track objects
 * @returns {Array<{artist?: string, track: string}>} - Sanitized array
 */
function sanitizeBlockedTracks(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const valid = list
    .filter(item => item && typeof item === 'object' && item.track)
    .map(item => {
      const track = normalize(item.track);
      // Only include artist if it's provided and non-empty
      const artist = item.artist && item.artist.trim().length > 0 
        ? normalize(item.artist) 
        : undefined;
      return { track, ...(artist !== undefined && { artist }) };
    })
    .filter(item => item.track.length > 0);
  
  // Remove duplicates by stringifying and using Set
  const seen = new Set();
  return valid.filter(item => {
    // Use empty string for artist if undefined
    const artistKey = item.artist || '';
    const key = `${artistKey}|||${item.track}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Sanitizes a blocked patterns array
 * @param {Array<string>} list - Array of pattern strings
 * @returns {Array<string>} - Sanitized array
 */
function sanitizeBlockedPatterns(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const normalized = list
    .map(pattern => typeof pattern === 'string' ? pattern.trim() : '')
    .filter(pattern => pattern.length > 0);
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
  
  const normalizedArtist = normalize(artistName);
  const normalizedBlocked = blockedArtists.map(normalize);
  
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

/**
 * Checks if a track matches any entry in the blocked tracks list
 * Tracks without artist match any artist
 * @param {string} artistName - The artist name (optional)
 * @param {string} trackName - The track name
 * @param {Array<{artist?: string, track: string}>} blockedTracks - Array of blocked tracks
 * @returns {boolean} - True if the track is blocked
 */
function isBlockedTrack(artistName, trackName, blockedTracks) {
  if (!trackName || !Array.isArray(blockedTracks)) {
    return false;
  }
  
  const normalizedArtist = artistName ? normalize(artistName) : undefined;
  const normalizedTrack = normalize(trackName);
  
  return blockedTracks.some(blocked => {
    if (blocked.track !== normalizedTrack) {
      return false;
    }
    // If blocked track has no artist, it matches any artist
    if (blocked.artist === undefined) {
      return true;
    }
    // If blocked track has an artist, it must match
    return normalizedArtist !== undefined && blocked.artist === normalizedArtist;
  });
}

/**
 * Matches a pattern against a string (simple glob-like matching)
 * Supports: "*word", "word*", "*word*", case-insensitive
 * @param {string} pattern - Pattern to match (e.g., "*live", "*acoustic")
 * @param {string} text - Text to match against
 * @returns {boolean} - True if pattern matches
 */
function matchPattern(pattern, text) {
  if (!pattern || !text) return false;
  
  const normalizedPattern = normalize(pattern);
  const normalizedText = normalize(text);
  
  // Remove asterisks and check if pattern is contained
  const cleanPattern = normalizedPattern.replace(/\*/g, '');
  if (cleanPattern.length === 0) return false;
  
  if (normalizedPattern.startsWith('*') && normalizedPattern.endsWith('*')) {
    // *word* - contains
    return normalizedText.includes(cleanPattern);
  } else if (normalizedPattern.startsWith('*')) {
    // *word - ends with
    return normalizedText.endsWith(cleanPattern);
  } else if (normalizedPattern.endsWith('*')) {
    // word* - starts with
    return normalizedText.startsWith(cleanPattern);
  } else {
    // exact match
    return normalizedText === normalizedPattern;
  }
}

/**
 * Checks if any artist in a list contains a blocked artist (for collaborations)
 * @param {Array<string>} artistNames - Array of artist names
 * @param {Array<string>} blockedArtists - Array of blocked artist names
 * @returns {boolean} - True if any collaboration is blocked
 */
function isCollaborationBlocked(artistNames, blockedArtists) {
  if (!Array.isArray(artistNames) || !Array.isArray(blockedArtists)) {
    return false;
  }
  
  const normalizedBlocked = blockedArtists.map(normalize);
  
  return artistNames.some(artistName => {
    const normalizedArtist = normalize(artistName);
    // Check if any blocked artist is contained in this artist name
    // (e.g., "Taylor Swift feat. Ed Sheeran" contains "Taylor Swift")
    return normalizedBlocked.some(blocked => normalizedArtist.includes(blocked));
  });
}

/**
 * Checks if a playing track should be blocked
 * Priority: reverse mode > track-level blocks > pattern blocks > artist-level blocks
 * @param {string|Array<string>} artistNames - Single artist name or array of artist names
 * @param {string} trackName - The track name
 * @param {Array<string>} blockedArtists - Array of blocked/allowed artist names
 * @param {Array<{artist?: string, track: string}>} blockedTracks - Array of blocked tracks
 * @param {Array<string>} blockedPatterns - Array of blocked patterns
 * @param {boolean} reverseMode - If true, blockedArtists becomes allowed list
 * @param {boolean} blockCollaborations - If true, check collaborations
 * @returns {{blocked: boolean, reason: "artist" | "track" | "pattern" | "reverse" | null}} - Block status and reason
 */
function isBlocked(artistNames, trackName, blockedArtists, blockedTracks, blockedPatterns = [], reverseMode = false, blockCollaborations = false) {
  const artistArray = Array.isArray(artistNames) ? artistNames : [artistNames];
  
  // 1) REVERSE MODE (whitelist-only) - highest priority
  if (reverseMode) {
    // In reverse mode, blocked_artists becomes the allowed list
    // If artist is NOT in allowed list, block it
    if (!isAnyArtistBlocked(artistArray, blockedArtists)) {
      return { blocked: true, reason: 'reverse' };
    }
    // If we're in reverse mode and artist IS allowed, continue to check other rules
    // (patterns and tracks can still block even allowed artists)
  }
  
  // 2) TRACK-LEVEL BLOCKS
  for (const artistName of artistArray) {
    if (isBlockedTrack(artistName, trackName, blockedTracks)) {
      return { blocked: true, reason: 'track' };
    }
  }
  
  // Also check track name directly (handles case where artistArray might be empty/null)
  const normalizedTrack = normalize(trackName);
  if (blockedTracks.some(blocked => 
    blocked.track === normalizedTrack && blocked.artist === undefined
  )) {
    return { blocked: true, reason: 'track' };
  }
  
  // 3) PATTERN MATCHING
  if (Array.isArray(blockedPatterns) && blockedPatterns.length > 0) {
    for (const pattern of blockedPatterns) {
      if (matchPattern(pattern, trackName)) {
        return { blocked: true, reason: 'pattern' };
      }
    }
  }
  
  // 4) ARTIST-LEVEL BLOCKS
  if (isAnyArtistBlocked(artistArray, blockedArtists)) {
    return { blocked: true, reason: 'artist' };
  }
  
  // 5) COLLABORATION BLOCKS (if enabled)
  if (blockCollaborations && !reverseMode) {
    if (isCollaborationBlocked(artistArray, blockedArtists)) {
      return { blocked: true, reason: 'artist' };
    }
  }
  
  return { blocked: false, reason: null };
}

module.exports = {
  normalize,
  normalizeName, // For backwards compatibility
  sanitizeBlockedList,
  sanitizeBlockedTracks,
  sanitizeBlockedPatterns,
  isBlockedArtist,
  isAnyArtistBlocked,
  isBlockedTrack,
  matchPattern,
  isCollaborationBlocked,
  isBlocked
};

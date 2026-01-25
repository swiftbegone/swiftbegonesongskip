/**
 * Preload script for settings window
 * Provides secure IPC communication between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('blocklistAPI', {
  /**
   * Get current blocklist data
   * @returns {Promise<{artists: string[], tracks: Array<{artist?: string, track: string}>, patterns: string[], blockCollaborations: boolean, reverseMode: boolean}>}
   */
  getBlocklist: () => ipcRenderer.invoke('blocklist:get'),
  
  /**
   * Set blocked artists list
   * @param {string[]} artists - Array of artist names
   * @returns {Promise<void>}
   */
  setBlockedArtists: (artists) => ipcRenderer.invoke('blocklist:set-artists', artists),
  
  /**
   * Set blocked tracks list
   * @param {Array<{artist?: string, track: string}>} tracks - Array of track objects
   * @returns {Promise<void>}
   */
  setBlockedTracks: (tracks) => ipcRenderer.invoke('blocklist:set-tracks', tracks),
  
  /**
   * Set blocked patterns list
   * @param {string[]} patterns - Array of pattern strings
   * @returns {Promise<void>}
   */
  setBlockedPatterns: (patterns) => ipcRenderer.invoke('blocklist:set-patterns', patterns),
  
  /**
   * Set block collaborations flag
   * @param {boolean} enabled - Whether to block collaborations
   * @returns {Promise<void>}
   */
  setBlockCollabs: (enabled) => ipcRenderer.invoke('blocklist:set-collabs', enabled),
  
  /**
   * Set reverse mode (whitelist-only)
   * @param {boolean} enabled - Whether reverse mode is enabled
   * @returns {Promise<void>}
   */
  setReverseMode: (enabled) => ipcRenderer.invoke('blocklist:set-reverse-mode', enabled),
  
  /**
   * Block the currently playing song
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  blockCurrentSong: () => ipcRenderer.invoke('blocklist:block-current-song'),
  
  /**
   * Block the currently playing artist
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  blockCurrentArtist: () => ipcRenderer.invoke('blocklist:block-current-artist'),
  
  /**
   * Get currently playing track info
   * @returns {Promise<{artist?: string|string[], track?: string, source?: string} | null>}
   */
  getNowPlaying: () => ipcRenderer.invoke('blocklist:get-now-playing'),
  
  /**
   * Get history of last 10 songs
   * @returns {Promise<Array<{id: string, ts: number, source: string, artist: string, track: string, reasonBlocked?: string}>>}
   */
  getHistory: () => ipcRenderer.invoke('history:get'),
  
  /**
   * Clear history
   * @returns {Promise<void>}
   */
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  
  /**
   * Block track from history entry
   * @param {string} id - History entry ID
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  blockTrackFromHistory: (id) => ipcRenderer.invoke('history:block-track', id),
  
  /**
   * Block artist from history entry
   * @param {string} id - History entry ID
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  blockArtistFromHistory: (id) => ipcRenderer.invoke('history:block-artist', id),
  
  /**
   * Get stats (session and total)
   * @returns {Promise<{session: {total: number, artist: number, track: number, pattern: number, reverse: number}, total: {total: number, artist: number, track: number, pattern: number, reverse: number}}>}
   */
  getStats: () => ipcRenderer.invoke('stats:get'),
  
  /**
   * Reset session stats
   * @returns {Promise<void>}
   */
  resetSessionStats: () => ipcRenderer.invoke('stats:reset-session'),
  
  /**
   * Reset total stats
   * @returns {Promise<void>}
   */
  resetTotalStats: () => ipcRenderer.invoke('stats:reset-total'),
  
  /**
   * Export blocklist to JSON
   * @returns {Promise<object>}
   */
  exportBlocklist: () => ipcRenderer.invoke('blocklist:export'),
  
  /**
   * Import blocklist from JSON
   * @param {object} data - Blocklist data
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  importBlocklist: (data) => ipcRenderer.invoke('blocklist:import', data),
  
  /**
   * Block a specific track
   * @param {string} artist - Artist name (optional)
   * @param {string} track - Track name
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  blockTrack: (artist, track) => ipcRenderer.invoke('blocklist:block-track', artist, track),
  
  /**
   * Block a specific artist
   * @param {string} artist - Artist name
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  blockArtist: (artist) => ipcRenderer.invoke('blocklist:block-artist', artist),
  
  /**
   * Open external URL
   * @param {string} url - URL to open
   */
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

// Listen for updates from main process
ipcRenderer.on('now-playing-updated', (event, data) => {
  window.dispatchEvent(new CustomEvent('now-playing-updated', { detail: data }));
});

ipcRenderer.on('history-updated', (event, data) => {
  window.dispatchEvent(new CustomEvent('history-updated', { detail: data }));
});

ipcRenderer.on('stats-updated', (event, data) => {
  window.dispatchEvent(new CustomEvent('stats-updated', { detail: data }));
});

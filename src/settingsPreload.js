/**
 * Preload script for settings window
 * Provides secure IPC communication between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('blocklistAPI', {
  /**
   * Get current blocklist data
   * @returns {Promise<{artists: string[], tracks: Array<{artist: string, track: string}>}>}
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
   * @param {Array<{artist: string, track: string}>} tracks - Array of track objects
   * @returns {Promise<void>}
   */
  setBlockedTracks: (tracks) => ipcRenderer.invoke('blocklist:set-tracks', tracks),
  
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
  getNowPlaying: () => ipcRenderer.invoke('blocklist:get-now-playing')
});

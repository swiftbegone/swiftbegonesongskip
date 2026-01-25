/**
 * SwiftBeGone - Main Electron process
 * Handles tray/menu bar, polling, and automatic skipping
 */

const { app, Tray, Menu, shell, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const spotify = require('./spotify');
const appleMusic = require('./appleMusic');
const { isBlocked, sanitizeBlockedList, sanitizeBlockedTracks, sanitizeBlockedPatterns, normalize } = require('./blocklist');
const crypto = require('crypto');

const store = new Store();

console.log("SwiftBeGone starting…", process.platform);

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  blocked_artists: ['Taylor Swift'],
  blocked_tracks: [],
  blocked_patterns: [], // Examples: "*live", "*acoustic", "*remix"
  block_collaborations: false,
  reverse_mode: false
};

// Initialize settings with defaults
if (!store.has('enabled')) {
  store.set('enabled', DEFAULT_SETTINGS.enabled);
}
if (!store.has('blocked_artists')) {
  store.set('blocked_artists', DEFAULT_SETTINGS.blocked_artists);
}
if (!store.has('blocked_tracks')) {
  store.set('blocked_tracks', DEFAULT_SETTINGS.blocked_tracks);
}
if (!store.has('blocked_patterns')) {
  store.set('blocked_patterns', DEFAULT_SETTINGS.blocked_patterns);
}
if (!store.has('block_collaborations')) {
  store.set('block_collaborations', DEFAULT_SETTINGS.block_collaborations);
}
if (!store.has('reverse_mode')) {
  store.set('reverse_mode', DEFAULT_SETTINGS.reverse_mode);
}
if (!store.has('stats_total_blocks')) {
  store.set('stats_total_blocks', 0);
}
if (!store.has('stats_total_blocks_artist')) {
  store.set('stats_total_blocks_artist', 0);
}
if (!store.has('stats_total_blocks_track')) {
  store.set('stats_total_blocks_track', 0);
}
if (!store.has('stats_total_blocks_pattern')) {
  store.set('stats_total_blocks_pattern', 0);
}
if (!store.has('stats_total_blocks_reverse')) {
  store.set('stats_total_blocks_reverse', 0);
}

// Settings window management
let settingsWindow = null;

let tray = null;
let pollingInterval = null;
let lastSkipTime = 0;
const SKIP_COOLDOWN_MS = 2500; // 2.5 seconds
const POLL_INTERVAL_MS = 2000; // 2 seconds when music is playing
const IDLE_POLL_INTERVAL_MS = 5000; // 5 seconds when paused/idle
let isMusicPlaying = false;

let currentStatus = {
  source: 'idle',
  artist: null,
  track: null,
  error: null
};

// History tracking (last 10 songs)
let history = [];
const MAX_HISTORY = 10;

// Session stats (reset on app restart)
let sessionStats = {
  total: 0,
  artist: 0,
  track: 0,
  pattern: 0,
  reverse: 0
};

// Canonical now playing object
let nowPlaying = null;

/**
 * Gets the icon path based on platform
 */
function getIconPath() {
  if (process.platform === 'darwin') {
    // macOS - use icon.ico for menu bar
    const iconPath = path.join(__dirname, '../assets/icon.ico');
    return fs.existsSync(iconPath) ? iconPath : null;
  } else {
    // Windows - use .ico or fallback
    const iconPath = path.join(__dirname, '../assets/icon.ico');
    return fs.existsSync(iconPath) ? iconPath : null;
  }
}

/**
 * Truncates a string to a maximum length with ellipsis
 */
function truncateString(str, maxLength = 60) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Formats now playing for the tray menu
 */
function formatNowPlayingForTray() {
  if (!nowPlaying || !nowPlaying.artist || !nowPlaying.track) {
    return 'Idle';
  }
  
  const artist = typeof nowPlaying.artist === 'string' ? nowPlaying.artist : nowPlaying.artist.join(', ');
  const track = truncateString(nowPlaying.track, 60);
  return `${truncateString(artist, 30)} — ${track}`;
}

/**
 * Creates the context menu for the tray
 */
function createMenu() {
  const enabled = store.get('enabled', true);
  const hasNowPlaying = nowPlaying && nowPlaying.artist && nowPlaying.track;
  const nowPlayingText = formatNowPlayingForTray();
  const canSkip = hasNowPlaying && (currentStatus.source === 'apple-music' || currentStatus.source === 'spotify');
  
  const template = [
    {
      label: `SwiftBeGone — ${enabled ? 'ENABLED' : 'DISABLED'}`,
      click: () => {
        store.set('enabled', !enabled);
        updateMenu();
      }
    },
    { type: 'separator' },
    {
      label: `Now Playing: ${nowPlayingText}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Block Current Song',
      enabled: hasNowPlaying,
      click: async () => {
        await blockCurrentSongFromTray();
      }
    },
    {
      label: 'Block Current Artist',
      enabled: hasNowPlaying,
      click: async () => {
        await blockCurrentArtistFromTray();
      }
    },
    {
      label: 'Skip Track',
      enabled: canSkip,
      click: async () => {
        await skipTrackFromTray();
      }
    },
    { type: 'separator' },
    {
      label: 'Dashboard…',
      click: () => {
        openSettingsWindow();
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ];
  
  return Menu.buildFromTemplate(template);
}

/**
 * Updates the tray menu
 */
function updateMenu() {
  if (tray) {
    tray.setContextMenu(createMenu());
  }
}

/**
 * Block current song from tray menu
 */
async function blockCurrentSongFromTray() {
  if (!nowPlaying || !nowPlaying.track) {
    return;
  }
  
  try {
    const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
    const normalized = {
      artist: nowPlaying.artist ? normalize(nowPlaying.artist) : undefined,
      track: normalize(nowPlaying.track)
    };
    
    // Check if already blocked
    if (blockedTracks.some(t => {
      if (t.track !== normalized.track) return false;
      if (t.artist === undefined) return true;
      return normalized.artist !== undefined && t.artist === normalized.artist;
    })) {
      console.log('Song is already blocked');
      return;
    }
    
    // Add the normalized track
    blockedTracks.push(normalized);
    store.set('blocked_tracks', sanitizeBlockedTracks(blockedTracks));
    
    // Update menu and notify settings window
    updateMenu();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('blocklist-updated');
    }
    
    console.log(`Blocked song from tray: ${nowPlaying.track}`);
  } catch (error) {
    console.error('Failed to block current song from tray:', error);
  }
}

/**
 * Block current artist from tray menu
 */
async function blockCurrentArtistFromTray() {
  if (!nowPlaying || !nowPlaying.artist) {
    return;
  }
  
  try {
    const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
    const artistName = typeof nowPlaying.artist === 'string' ? nowPlaying.artist : nowPlaying.artist[0];
    const normalizedArtist = normalize(artistName);
    
    // Check if already blocked
    if (blockedArtists.some(a => normalize(a) === normalizedArtist)) {
      console.log('Artist is already blocked');
      return;
    }
    
    // Add the artist
    blockedArtists.push(artistName);
    store.set('blocked_artists', sanitizeBlockedList(blockedArtists));
    
    // Update menu and notify settings window
    updateMenu();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('blocklist-updated');
    }
    
    console.log(`Blocked artist from tray: ${artistName}`);
  } catch (error) {
    console.error('Failed to block current artist from tray:', error);
  }
}

/**
 * Skip track from tray menu (manual skip, doesn't increment stats)
 */
async function skipTrackFromTray() {
  if (!currentStatus.source || currentStatus.source === 'idle') {
    return;
  }
  
  const now = Date.now();
  if (now - lastSkipTime < SKIP_COOLDOWN_MS) {
    console.log(`Skip cooldown active (${now - lastSkipTime}ms < ${SKIP_COOLDOWN_MS}ms)`);
    return;
  }
  
  console.log(`Manually skipping track on ${currentStatus.source}…`);
  try {
    if (currentStatus.source === 'spotify') {
      await spotify.skipToNext();
    } else if (currentStatus.source === 'apple-music') {
      await appleMusic.skipToNext();
    }
    lastSkipTime = now;
    console.log(`Track manually skipped on ${currentStatus.source}.`);
    // Note: Manual skips don't increment stats
  } catch (error) {
    console.error(`Error manually skipping track: ${error.message}`);
  }
}

/**
 * Updates now playing and adds to history if changed
 */
function updateNowPlayingAndHistory(source, artist, track) {
  const artistStr = Array.isArray(artist) ? artist.join(', ') : artist;
  
  // Check if now playing has changed
  if (nowPlaying && 
      nowPlaying.artist === artistStr && 
      nowPlaying.track === track && 
      nowPlaying.source === source) {
    return; // No change
  }
  
  // Update now playing
  nowPlaying = {
    source,
    artist: artistStr,
    track: track || '',
    timestamp: Date.now()
  };
  
  // Add to history
  const historyEntry = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    source: source,
    artist: artistStr,
    track: track || ''
  };
  
  history.unshift(historyEntry);
  if (history.length > MAX_HISTORY) {
    history.pop();
  }
  
  // Notify settings window if open
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('now-playing-updated', nowPlaying);
    settingsWindow.webContents.send('history-updated', history);
  }
  
  // Update tray menu when now playing changes
  updateMenu();
}

/**
 * Increments stats counters
 */
function incrementStats(reason) {
  // Session stats
  sessionStats.total++;
  if (reason === 'artist') {
    sessionStats.artist++;
  } else if (reason === 'track') {
    sessionStats.track++;
  } else if (reason === 'pattern') {
    sessionStats.pattern++;
  } else if (reason === 'reverse') {
    sessionStats.reverse++;
  }
  
  // Persisted stats
  store.set('stats_total_blocks', store.get('stats_total_blocks', 0) + 1);
  if (reason === 'artist') {
    store.set('stats_total_blocks_artist', store.get('stats_total_blocks_artist', 0) + 1);
  } else if (reason === 'track') {
    store.set('stats_total_blocks_track', store.get('stats_total_blocks_track', 0) + 1);
  } else if (reason === 'pattern') {
    store.set('stats_total_blocks_pattern', store.get('stats_total_blocks_pattern', 0) + 1);
  } else if (reason === 'reverse') {
    store.set('stats_total_blocks_reverse', store.get('stats_total_blocks_reverse', 0) + 1);
  }
  
  // Update menu to show new counters
  updateMenu();
  
  // Notify settings window if open
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('stats-updated', {
      session: sessionStats,
      total: {
        total: store.get('stats_total_blocks', 0),
        artist: store.get('stats_total_blocks_artist', 0),
        track: store.get('stats_total_blocks_track', 0),
        pattern: store.get('stats_total_blocks_pattern', 0),
        reverse: store.get('stats_total_blocks_reverse', 0)
      }
    });
  }
}

/**
 * Opens the settings window (or focuses if already open)
 */
function openSettingsWindow() {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.focus();
    return;
  }
  
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: true,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'settingsPreload.js')
    },
    title: 'SwiftBeGone - Dashboard',
    show: false
  });
  
  settingsWindow.loadFile(path.join(__dirname, 'dashboard.html'));
  
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Handles skipping a track based on the current source
 * @param {string} source - The music source ('spotify' or 'apple-music')
 * @param {string} reason - The reason for blocking ('artist', 'track', 'pattern', 'reverse')
 */
async function handleSkip(source, reason) {
  const now = Date.now();
  if (now - lastSkipTime < SKIP_COOLDOWN_MS) {
    console.log(`Skip cooldown active (${now - lastSkipTime}ms < ${SKIP_COOLDOWN_MS}ms)`);
    return; // Still in cooldown
  }
  
  console.log(`Skipping track on ${source} (reason: ${reason})…`);
  try {
    if (source === 'spotify') {
      await spotify.skipToNext();
    } else if (source === 'apple-music') {
      await appleMusic.skipToNext();
    }
    lastSkipTime = now;
    console.log(`Track skipped on ${source}.`);
    
    // Increment stats only when skip actually occurs
    incrementStats(reason);
    
    // Mark current history entry as blocked if it exists
    if (history.length > 0 && nowPlaying) {
      const latestEntry = history[0];
      if (latestEntry.artist === nowPlaying.artist && latestEntry.track === nowPlaying.track) {
        latestEntry.reasonBlocked = reason;
        // Notify settings window
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.webContents.send('history-updated', history);
        }
      }
    }
  } catch (error) {
    console.error(`Error skipping track: ${error.message}`);
    currentStatus.error = error.message;
    updateMenu();
    setTimeout(() => {
      currentStatus.error = null;
      updateMenu();
    }, 5000);
  }
}

/**
 * Main polling function - checks what's playing and skips if needed
 */
async function pollNowPlaying() {
  const enabled = store.get('enabled', true);
  if (!enabled) {
    // Still update status, but don't skip
    const wasPlaying = isMusicPlaying;
    isMusicPlaying = false;
    if (wasPlaying) {
      updatePollingInterval(); // Switch to slower polling when disabled
    }
    currentStatus.source = 'idle';
    currentStatus.artist = null;
    currentStatus.track = null;
    updateMenu();
    return;
  }

  console.log("Polling for currently playing track…");
  try {
    // Priority 1: Spotify (if connected)
    if (spotify.isSpotifyConnected()) {
      try {
        const spotifyTrack = await spotify.getCurrentlyPlaying();
        if (spotifyTrack && spotifyTrack.isPlaying) {
          const wasPlaying = isMusicPlaying;
          isMusicPlaying = true;
          if (!wasPlaying) {
            updatePollingInterval(); // Switch to faster polling
          }
          
          currentStatus.source = 'spotify';
          currentStatus.artist = spotifyTrack.artists;
          currentStatus.track = spotifyTrack.track;
          currentStatus.error = null;
          
          // Update now playing and history
          updateNowPlayingAndHistory('spotify', spotifyTrack.artists, spotifyTrack.track);
          
          // Check if track or artist is blocked
          const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
          const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
          const blockedPatterns = sanitizeBlockedPatterns(store.get('blocked_patterns', []));
          const reverseMode = store.get('reverse_mode', false);
          const blockCollaborations = store.get('block_collaborations', false);
          
          const blocked = isBlocked(
            spotifyTrack.artists, 
            spotifyTrack.track, 
            blockedArtists, 
            blockedTracks,
            blockedPatterns,
            reverseMode,
            blockCollaborations
          );
          
          if (blocked.blocked) {
            console.log(`Blocked ${blocked.reason}: ${spotifyTrack.track}`);
            await handleSkip('spotify', blocked.reason);
          }
          
          updateMenu();
          return;
        }
      } catch (error) {
        // If Spotify API fails, try other sources
        console.error('Spotify polling error:', error.message);
      }
    }

    // Priority 2: Apple Music (macOS only)
    if (process.platform === 'darwin') {
      try {
        const appleTrack = await appleMusic.getCurrentlyPlaying();
        if (appleTrack && appleTrack.isPlaying) {
          const wasPlaying = isMusicPlaying;
          isMusicPlaying = true;
          if (!wasPlaying) {
            updatePollingInterval(); // Switch to faster polling
          }
          
          currentStatus.source = 'apple-music';
          currentStatus.artist = appleTrack.artist;
          currentStatus.track = appleTrack.track;
          currentStatus.error = null;
          
          // Update now playing and history
          updateNowPlayingAndHistory('apple-music', appleTrack.artist, appleTrack.track);
          
          // Check if track or artist is blocked
          const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
          const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
          const blockedPatterns = sanitizeBlockedPatterns(store.get('blocked_patterns', []));
          const reverseMode = store.get('reverse_mode', false);
          const blockCollaborations = store.get('block_collaborations', false);
          
          const blocked = isBlocked(
            [appleTrack.artist], 
            appleTrack.track, 
            blockedArtists, 
            blockedTracks,
            blockedPatterns,
            reverseMode,
            blockCollaborations
          );
          
          if (blocked.blocked) {
            console.log(`Blocked ${blocked.reason}: ${appleTrack.track}`);
            await handleSkip('apple-music', blocked.reason);
          }
          
          updateMenu();
          return;
        }
      } catch (error) {
        // If Apple Music fails, continue to idle
        console.error('Apple Music polling error:', error.message);
      }
    }

    // No active source - music is paused or not playing
    const wasPlaying = isMusicPlaying;
    isMusicPlaying = false;
    if (wasPlaying) {
      updatePollingInterval(); // Switch to slower polling when paused
    }
    
    currentStatus.source = 'idle';
    currentStatus.artist = null;
    currentStatus.track = null;
    currentStatus.error = null;
    console.log("No active music source detected (paused or idle).");
    updateMenu();
  } catch (error) {
    console.error('Polling error:', error.message);
    currentStatus.error = error.message;
    updateMenu();
  }
}

/**
 * Initializes the tray icon and menu
 */
function createTray() {
  console.log("Creating tray…");
  const iconPath = getIconPath();
  
  tray = new Tray(iconPath || path.join(__dirname, '../assets/icon.ico'));
  
  tray.setToolTip('SwiftBeGone');
  tray.setContextMenu(createMenu());
  
  // On macOS, click should also show menu
  if (process.platform === 'darwin') {
    tray.on('click', () => {
      tray.popUpContextMenu();
    });
  }
  console.log("Tray created.");
}

/**
 * Starts or restarts the polling interval with appropriate frequency
 */
function startPolling() {
  console.log("Starting polling…");
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Poll immediately, then set interval based on current state
  pollNowPlaying();
  updatePollingInterval();
  console.log("Polling started.");
}

/**
 * Updates polling interval based on whether music is currently playing
 */
function updatePollingInterval() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  const interval = isMusicPlaying ? POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
  pollingInterval = setInterval(pollNowPlaying, interval);
  console.log(`Polling interval set to ${interval}ms (${isMusicPlaying ? 'active' : 'idle'})`);
}

/**
 * Stops the polling interval
 */
function stopPolling() {
  console.log("Stopping polling…");
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  console.log("Polling stopped.");
}

// IPC handlers for settings window
ipcMain.handle('blocklist:get', async () => {
  return {
    artists: store.get('blocked_artists', []),
    tracks: store.get('blocked_tracks', []),
    patterns: store.get('blocked_patterns', []),
    blockCollaborations: store.get('block_collaborations', false),
    reverseMode: store.get('reverse_mode', false)
  };
});

ipcMain.handle('blocklist:set-artists', async (event, artists) => {
  const sanitized = sanitizeBlockedList(artists);
  store.set('blocked_artists', sanitized);
  updateMenu();
  return;
});

ipcMain.handle('blocklist:set-tracks', async (event, tracks) => {
  const sanitized = sanitizeBlockedTracks(tracks);
  store.set('blocked_tracks', sanitized);
  updateMenu();
  return;
});

ipcMain.handle('blocklist:set-patterns', async (event, patterns) => {
  const sanitized = sanitizeBlockedPatterns(patterns);
  store.set('blocked_patterns', sanitized);
  updateMenu();
  return;
});

ipcMain.handle('blocklist:set-collabs', async (event, enabled) => {
  store.set('block_collaborations', !!enabled);
  updateMenu();
  return;
});

ipcMain.handle('blocklist:set-reverse-mode', async (event, enabled) => {
  store.set('reverse_mode', !!enabled);
  updateMenu();
  return;
});

ipcMain.handle('blocklist:block-current-song', async () => {
  // Get currently playing track from Apple Music (Spotify ignored for now)
  if (process.platform !== 'darwin') {
    return { success: false, message: 'Apple Music is only available on macOS' };
  }
  
  try {
    const appleTrack = await appleMusic.getCurrentlyPlaying();
    if (!appleTrack || !appleTrack.isPlaying) {
      return { success: false, message: 'No music is currently playing' };
    }
    
    const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
    
    // Normalize the track for comparison
    const normalized = {
      artist: normalize(appleTrack.artist),
      track: normalize(appleTrack.track)
    };
    
    // Check if already blocked (including tracks without artist)
    if (blockedTracks.some(t => {
      if (t.track !== normalized.track) return false;
      // Track matches - check artist
      // If blocked track has no artist, it matches any artist
      if (t.artist === undefined) return true;
      // If blocked track has an artist, it must match
      return t.artist === normalized.artist;
    })) {
      return { success: false, message: 'This song is already blocked' };
    }
    
    // Add the normalized track and sanitize the entire list
    blockedTracks.push(normalized);
    const sanitized = sanitizeBlockedTracks(blockedTracks);
    store.set('blocked_tracks', sanitized);
    
    return { 
      success: true, 
      message: `${appleTrack.artist} — ${appleTrack.track}` 
    };
  } catch (error) {
    console.error('Failed to block current song:', error);
    return { success: false, message: error.message || 'Failed to get current song' };
  }
});

ipcMain.handle('blocklist:block-current-artist', async () => {
  // Get currently playing track from Apple Music (Spotify ignored for now)
  if (process.platform !== 'darwin') {
    return { success: false, message: 'Apple Music is only available on macOS' };
  }
  
  try {
    const appleTrack = await appleMusic.getCurrentlyPlaying();
    if (!appleTrack || !appleTrack.isPlaying) {
      return { success: false, message: 'No music is currently playing' };
    }
    
    const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
    const artistName = appleTrack.artist;
    const normalizedArtist = normalize(artistName);
    
    // Check if already blocked (compare normalized)
    if (blockedArtists.some(a => normalize(a) === normalizedArtist)) {
      return { success: false, message: 'This artist is already blocked' };
    }
    
    // Add the original artist name and sanitize the entire list
    blockedArtists.push(artistName);
    store.set('blocked_artists', sanitizeBlockedList(blockedArtists));
    
    return { 
      success: true, 
      message: artistName 
    };
  } catch (error) {
    console.error('Failed to block current artist:', error);
    return { success: false, message: error.message || 'Failed to get current artist' };
  }
});

ipcMain.handle('blocklist:get-now-playing', async () => {
  // Try Apple Music first (Spotify ignored for now)
  if (process.platform === 'darwin') {
    try {
      const appleTrack = await appleMusic.getCurrentlyPlaying();
      if (appleTrack && appleTrack.isPlaying) {
        return {
          artist: appleTrack.artist,
          track: appleTrack.track,
          source: 'apple-music'
        };
      }
    } catch (error) {
      // Ignore errors, try other sources
    }
  }
  
  // Fall back to currentStatus if available
  if (currentStatus.artist && currentStatus.track) {
    return {
      artist: currentStatus.artist,
      track: currentStatus.track,
      source: currentStatus.source
    };
  }
  
  return null;
});

// History IPC handlers
ipcMain.handle('history:get', async () => {
  return history;
});

ipcMain.handle('history:clear', async () => {
  history = [];
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('history-updated', history);
  }
  return;
});

ipcMain.handle('history:block-track', async (event, id) => {
  const entry = history.find(e => e.id === id);
  if (!entry) {
    return { success: false, message: 'History entry not found' };
  }
  
  const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
  const normalized = {
    artist: entry.artist ? normalize(entry.artist) : undefined,
    track: normalize(entry.track)
  };
  
  // Check if already blocked
  if (blockedTracks.some(t => {
    if (t.track !== normalized.track) return false;
    if (t.artist === undefined) return true;
    return normalized.artist !== undefined && t.artist === normalized.artist;
  })) {
    return { success: false, message: 'This song is already blocked' };
  }
  
  blockedTracks.push(normalized);
  store.set('blocked_tracks', sanitizeBlockedTracks(blockedTracks));
  updateMenu();
  return { success: true };
});

ipcMain.handle('history:block-artist', async (event, id) => {
  const entry = history.find(e => e.id === id);
  if (!entry || !entry.artist) {
    return { success: false, message: 'History entry not found or no artist' };
  }
  
  const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
  const normalizedArtist = normalize(entry.artist);
  
  if (blockedArtists.some(a => normalize(a) === normalizedArtist)) {
    return { success: false, message: 'This artist is already blocked' };
  }
  
  blockedArtists.push(entry.artist);
  store.set('blocked_artists', sanitizeBlockedList(blockedArtists));
  updateMenu();
  return { success: true };
});

// Stats IPC handlers
ipcMain.handle('stats:get', async () => {
  return {
    session: sessionStats,
    total: {
      total: store.get('stats_total_blocks', 0),
      artist: store.get('stats_total_blocks_artist', 0),
      track: store.get('stats_total_blocks_track', 0),
      pattern: store.get('stats_total_blocks_pattern', 0),
      reverse: store.get('stats_total_blocks_reverse', 0)
    }
  };
});

ipcMain.handle('stats:reset-session', async () => {
  sessionStats = {
    total: 0,
    artist: 0,
    track: 0,
    pattern: 0,
    reverse: 0
  };
  updateMenu();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('stats-updated', {
      session: sessionStats,
      total: {
        total: store.get('stats_total_blocks', 0),
        artist: store.get('stats_total_blocks_artist', 0),
        track: store.get('stats_total_blocks_track', 0),
        pattern: store.get('stats_total_blocks_pattern', 0),
        reverse: store.get('stats_total_blocks_reverse', 0)
      }
    });
  }
  return;
});

ipcMain.handle('stats:reset-total', async () => {
  store.set('stats_total_blocks', 0);
  store.set('stats_total_blocks_artist', 0);
  store.set('stats_total_blocks_track', 0);
  store.set('stats_total_blocks_pattern', 0);
  store.set('stats_total_blocks_reverse', 0);
  updateMenu();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('stats-updated', {
      session: sessionStats,
      total: {
        total: 0,
        artist: 0,
        track: 0,
        pattern: 0,
        reverse: 0
      }
    });
  }
  return;
});

// Export/Import IPC handlers
ipcMain.handle('blocklist:export', async () => {
  return {
    artists: store.get('blocked_artists', []),
    tracks: store.get('blocked_tracks', []),
    patterns: store.get('blocked_patterns', []),
    blockCollaborations: store.get('block_collaborations', false),
    reverseMode: store.get('reverse_mode', false),
    version: '1.0'
  };
});

ipcMain.handle('blocklist:import', async (event, data) => {
  try {
    // Validate data structure
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid data format' };
    }
    
    // Import with validation
    if (Array.isArray(data.artists)) {
      store.set('blocked_artists', sanitizeBlockedList(data.artists));
    }
    if (Array.isArray(data.tracks)) {
      store.set('blocked_tracks', sanitizeBlockedTracks(data.tracks));
    }
    if (Array.isArray(data.patterns)) {
      store.set('blocked_patterns', sanitizeBlockedPatterns(data.patterns));
    }
    if (typeof data.blockCollaborations === 'boolean') {
      store.set('block_collaborations', data.blockCollaborations);
    }
    if (typeof data.reverseMode === 'boolean') {
      store.set('reverse_mode', data.reverseMode);
    }
    
    updateMenu();
    return { success: true };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, message: error.message || 'Import failed' };
  }
});

// Block track/artist helpers
ipcMain.handle('blocklist:block-track', async (event, artist, track) => {
  const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
  const normalized = {
    artist: artist ? normalize(artist) : undefined,
    track: normalize(track)
  };
  
  if (blockedTracks.some(t => {
    if (t.track !== normalized.track) return false;
    if (t.artist === undefined) return true;
    return normalized.artist !== undefined && t.artist === normalized.artist;
  })) {
    return { success: false, message: 'This song is already blocked' };
  }
  
  blockedTracks.push(normalized);
  store.set('blocked_tracks', sanitizeBlockedTracks(blockedTracks));
  updateMenu();
  return { success: true };
});

ipcMain.handle('blocklist:block-artist', async (event, artist) => {
  const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
  const normalizedArtist = normalize(artist);
  
  if (blockedArtists.some(a => normalize(a) === normalizedArtist)) {
    return { success: false, message: 'This artist is already blocked' };
  }
  
  blockedArtists.push(artist);
  store.set('blocked_artists', sanitizeBlockedList(blockedArtists));
  updateMenu();
  return { success: true };
});

// Open external URL handler
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

// App lifecycle
app.whenReady().then(() => {
  console.log("App ready, initializing…");
  createTray();
  startPolling();
  
  // Update menu periodically to refresh status
  setInterval(updateMenu, 2000);
  console.log("App initialized.");
});

app.on('window-all-closed', (e) => {
  // Prevent default behavior - keep app running
  e.preventDefault();
});

app.on('before-quit', () => {
  stopPolling();
});

// Handle app activation (macOS)
app.on('activate', () => {
  if (!tray) {
    createTray();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("Another instance is already running, quitting…");
  app.quit();
} else {
  app.on('second-instance', () => {
    console.log("Second instance detected, showing menu…");
    // Focus existing instance
    if (tray) {
      tray.popUpContextMenu();
    }
  });
}

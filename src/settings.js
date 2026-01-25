/**
 * Dashboard window renderer script
 * Handles UI interactions, navigation, and communicates with main process via preload API
 */

let blockedArtists = [];
let blockedTracks = [];
let blockedPatterns = [];
let blockCollaborations = false;
let reverseMode = false;
let history = [];
let stats = {
  session: { total: 0, artist: 0, track: 0, pattern: 0, reverse: 0 },
  total: { total: 0, artist: 0, track: 0, pattern: 0, reverse: 0 }
};
let nowPlaying = null;
let currentPage = 'dashboard';

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// DOM elements - Dashboard
const nowPlayingCard = document.getElementById('now-playing-card');
const nowPlayingInfo = document.getElementById('now-playing-info');
const blockCurrentSongBtn = document.getElementById('block-current-song-btn');
const blockCurrentArtistBtn = document.getElementById('block-current-artist-btn');
const sessionTotalDisplay = document.getElementById('session-total-display');
const totalBlocksDisplay = document.getElementById('total-blocks-display');
const reverseToggleLarge = document.getElementById('reverse-toggle-large');
const collabsToggleLarge = document.getElementById('collabs-toggle-large');

// DOM elements - History
const historyListEl = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// DOM elements - Blocklist
const artistsListEl = document.getElementById('artists-list');
const tracksListEl = document.getElementById('tracks-list');
const artistsSectionTitle = document.getElementById('artists-section-title');
const newArtistInputEl = document.getElementById('new-artist-input');
const addArtistBtn = document.getElementById('add-artist-btn');
const newSongArtistInputEl = document.getElementById('new-song-artist-input');
const newSongTrackInputEl = document.getElementById('new-song-track-input');
const addSongBtn = document.getElementById('add-song-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');

// DOM elements - Patterns
const patternsListEl = document.getElementById('patterns-list');
const newPatternInputEl = document.getElementById('new-pattern-input');
const addPatternBtn = document.getElementById('add-pattern-btn');
const collabsTogglePatterns = document.getElementById('collabs-toggle-patterns');
const reverseTogglePatterns = document.getElementById('reverse-toggle-patterns');

// DOM elements - Statistics
const resetSessionBtn = document.getElementById('reset-session-btn');
const resetTotalBtn = document.getElementById('reset-total-btn');

// DOM elements - Settings
const githubLink = document.getElementById('github-link');
const donateLink = document.getElementById('donate-link');
const helpLink = document.getElementById('help-link');

/**
 * Navigation
 */
function navigateToPage(pageName) {
  currentPage = pageName;
  
  // Update nav items
  navItems.forEach(item => {
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Show/hide pages
  pages.forEach(page => {
    if (page.id === `${pageName}-page`) {
      page.classList.add('active');
    } else {
      page.classList.remove('active');
    }
  });
  
  // Load page-specific data
  if (pageName === 'history') {
    loadHistory();
  } else if (pageName === 'statistics') {
    loadStats();
  }
}

// Navigation event listeners
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navigateToPage(item.dataset.page);
  });
});

/**
 * Show toast message
 */
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Load and display current blocklist
 */
async function loadBlocklist() {
  try {
    const data = await window.blocklistAPI.getBlocklist();
    blockedArtists = data.artists || [];
    blockedTracks = data.tracks || [];
    blockedPatterns = data.patterns || [];
    blockCollaborations = data.blockCollaborations || false;
    reverseMode = data.reverseMode || false;
    
    renderArtists();
    renderTracks();
    renderPatterns();
    updateToggles();
    updateArtistsSectionTitle();
  } catch (error) {
    console.error('Failed to load blocklist:', error);
    showToast('Failed to load blocklist', 3000);
  }
}

/**
 * Load history
 */
async function loadHistory() {
  try {
    history = await window.blocklistAPI.getHistory();
    renderHistory();
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

/**
 * Load stats
 */
async function loadStats() {
  try {
    stats = await window.blocklistAPI.getStats();
    renderStats();
    updateDashboardStats();
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

/**
 * Update dashboard stats display
 */
function updateDashboardStats() {
  if (sessionTotalDisplay) {
    sessionTotalDisplay.textContent = stats.session.total || 0;
  }
  if (totalBlocksDisplay) {
    totalBlocksDisplay.textContent = stats.total.total || 0;
  }
}

/**
 * Update now playing display
 */
async function updateNowPlaying() {
  try {
    nowPlaying = await window.blocklistAPI.getNowPlaying();
    
    if (nowPlaying && nowPlaying.artist && nowPlaying.track) {
      const artistStr = Array.isArray(nowPlaying.artist) 
        ? nowPlaying.artist.join(', ') 
        : nowPlaying.artist;
      nowPlayingInfo.innerHTML = `
        <div><strong>Source:</strong> ${escapeHtml(nowPlaying.source || 'Unknown')}</div>
        <div><strong>Artist:</strong> ${escapeHtml(artistStr)}</div>
        <div><strong>Track:</strong> ${escapeHtml(nowPlaying.track)}</div>
      `;
      if (blockCurrentSongBtn) blockCurrentSongBtn.disabled = false;
      if (blockCurrentArtistBtn) blockCurrentArtistBtn.disabled = false;
    } else {
      nowPlayingInfo.innerHTML = '<div>No music playing</div>';
      if (blockCurrentSongBtn) blockCurrentSongBtn.disabled = true;
      if (blockCurrentArtistBtn) blockCurrentArtistBtn.disabled = true;
    }
  } catch (error) {
    console.error('Failed to update now playing:', error);
    if (nowPlayingInfo) nowPlayingInfo.innerHTML = '<div>Error loading now playing</div>';
    if (blockCurrentSongBtn) blockCurrentSongBtn.disabled = true;
    if (blockCurrentArtistBtn) blockCurrentArtistBtn.disabled = true;
  }
}

/**
 * Render history list
 */
function renderHistory() {
  if (!historyListEl) return;
  
  if (history.length === 0) {
    historyListEl.innerHTML = '<div class="list-empty">No history yet</div>';
    return;
  }
  
  historyListEl.innerHTML = history.map(entry => {
    const time = new Date(entry.ts).toLocaleTimeString();
    const isBlocked = entry.reasonBlocked !== undefined;
    const blockedClass = isBlocked ? 'blocked' : '';
    const blockedBadge = isBlocked ? `<span style="color: #ff4444; font-size: 10px; margin-left: 8px;">[Blocked: ${entry.reasonBlocked}]</span>` : '';
    
    return `
      <div class="history-item ${blockedClass}">
        <div class="history-item-content">
          <div class="history-item-title">${escapeHtml(entry.artist || 'Unknown')} — ${escapeHtml(entry.track || 'Unknown')}</div>
          <div class="history-item-meta">${time} • ${escapeHtml(entry.source || 'Unknown')}${blockedBadge}</div>
        </div>
        <div class="history-item-actions">
          <button class="block-btn-small" onclick="blockTrackFromHistory('${entry.id}')" ${isBlocked ? 'disabled' : ''}>Block Song</button>
          <button class="block-btn-small" onclick="blockArtistFromHistory('${entry.id}')" ${isBlocked ? 'disabled' : ''}>Block Artist</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render blocked artists list
 */
function renderArtists() {
  if (!artistsListEl) return;
  
  if (blockedArtists.length === 0) {
    artistsListEl.innerHTML = '<div class="list-empty">No blocked artists</div>';
    return;
  }
  
  artistsListEl.innerHTML = blockedArtists.map((artist, index) => `
    <div class="list-item">
      <span class="list-item-text">${escapeHtml(artist)}</span>
      <button class="remove-btn" onclick="removeArtist(${index})">Remove</button>
    </div>
  `).join('');
}

/**
 * Render blocked tracks list
 */
function renderTracks() {
  if (!tracksListEl) return;
  
  if (blockedTracks.length === 0) {
    tracksListEl.innerHTML = '<div class="list-empty">No blocked songs</div>';
    return;
  }
  
  tracksListEl.innerHTML = blockedTracks.map((track, index) => {
    const displayText = track.artist 
      ? `${escapeHtml(track.artist)} — ${escapeHtml(track.track)}`
      : escapeHtml(track.track);
    return `
      <div class="list-item">
        <span class="list-item-text">${displayText}</span>
        <button class="remove-btn" onclick="removeTrack(${index})">Remove</button>
      </div>
    `;
  }).join('');
}

/**
 * Render blocked patterns list
 */
function renderPatterns() {
  if (!patternsListEl) return;
  
  if (blockedPatterns.length === 0) {
    patternsListEl.innerHTML = '<div class="list-empty">No patterns blocked</div>';
    return;
  }
  
  patternsListEl.innerHTML = blockedPatterns.map((pattern, index) => `
    <div class="list-item">
      <span class="list-item-text">${escapeHtml(pattern)}</span>
      <button class="remove-btn" onclick="removePattern(${index})">Remove</button>
    </div>
  `).join('');
}

/**
 * Render stats
 */
function renderStats() {
  if (document.getElementById('session-total')) {
    document.getElementById('session-total').textContent = stats.session.total || 0;
    document.getElementById('session-artist').textContent = stats.session.artist || 0;
    document.getElementById('session-track').textContent = stats.session.track || 0;
    document.getElementById('session-pattern').textContent = stats.session.pattern || 0;
    document.getElementById('session-reverse').textContent = stats.session.reverse || 0;
  }
  
  if (document.getElementById('total-total')) {
    document.getElementById('total-total').textContent = stats.total.total || 0;
    document.getElementById('total-artist').textContent = stats.total.artist || 0;
    document.getElementById('total-track').textContent = stats.total.track || 0;
    document.getElementById('total-pattern').textContent = stats.total.pattern || 0;
    document.getElementById('total-reverse').textContent = stats.total.reverse || 0;
  }
  
  updateDashboardStats();
}

/**
 * Update toggles UI
 */
function updateToggles() {
  if (reverseToggleLarge) {
    reverseToggleLarge.classList.toggle('active', reverseMode);
  }
  if (collabsToggleLarge) {
    collabsToggleLarge.classList.toggle('active', blockCollaborations);
  }
  if (reverseTogglePatterns) {
    reverseTogglePatterns.classList.toggle('active', reverseMode);
  }
  if (collabsTogglePatterns) {
    collabsTogglePatterns.classList.toggle('active', blockCollaborations);
  }
}

/**
 * Update artists section title based on reverse mode
 */
function updateArtistsSectionTitle() {
  if (artistsSectionTitle) {
    artistsSectionTitle.textContent = reverseMode ? 'Allowed Artists (Whitelist)' : 'Blocked Artists';
  }
}

/**
 * Add an artist to the blocklist
 */
async function addArtist() {
  const artist = newArtistInputEl.value.trim();
  if (!artist) {
    showToast('Please enter an artist name', 2000);
    return;
  }
  
  if (blockedArtists.some(a => a.toLowerCase() === artist.toLowerCase())) {
    showToast('This artist is already blocked', 2000);
    newArtistInputEl.value = '';
    return;
  }
  
  blockedArtists.push(artist);
  newArtistInputEl.value = '';
  
  try {
    await window.blocklistAPI.setBlockedArtists(blockedArtists);
    renderArtists();
    showToast('Artist added', 1500);
  } catch (error) {
    console.error('Failed to save artist:', error);
    showToast('Failed to save artist', 2000);
    blockedArtists.pop();
    renderArtists();
  }
}

/**
 * Remove an artist from the blocklist
 */
async function removeArtist(index) {
  blockedArtists.splice(index, 1);
  
  try {
    await window.blocklistAPI.setBlockedArtists(blockedArtists);
    renderArtists();
    showToast('Artist removed', 1500);
  } catch (error) {
    console.error('Failed to remove artist:', error);
    showToast('Failed to remove artist', 2000);
    loadBlocklist();
  }
}

/**
 * Add a track to the blocklist
 */
async function addSong() {
  const artist = newSongArtistInputEl.value.trim();
  const track = newSongTrackInputEl.value.trim();
  
  if (!track) {
    showToast('Please enter a track name', 2000);
    return;
  }
  
  const newTrack = { artist: artist.length > 0 ? artist : undefined, track: track };
  
  // Check for duplicates
  const isDuplicate = blockedTracks.some(t =>
    (t.artist || '').toLowerCase() === (newTrack.artist || '').toLowerCase() &&
    t.track.toLowerCase() === newTrack.track.toLowerCase()
  );
  
  if (isDuplicate) {
    showToast('This song is already blocked', 2000);
    newSongArtistInputEl.value = '';
    newSongTrackInputEl.value = '';
    return;
  }
  
  blockedTracks.push(newTrack);
  newSongArtistInputEl.value = '';
  newSongTrackInputEl.value = '';
  
  try {
    await window.blocklistAPI.setBlockedTracks(blockedTracks);
    renderTracks();
    showToast('Song added', 1500);
  } catch (error) {
    console.error('Failed to save song:', error);
    showToast('Failed to save song', 2000);
    blockedTracks.pop();
    renderTracks();
  }
}

/**
 * Remove a track from the blocklist
 */
async function removeTrack(index) {
  blockedTracks.splice(index, 1);
  
  try {
    await window.blocklistAPI.setBlockedTracks(blockedTracks);
    renderTracks();
    showToast('Song removed', 1500);
  } catch (error) {
    console.error('Failed to remove track:', error);
    showToast('Failed to remove track', 2000);
    loadBlocklist();
  }
}

/**
 * Add a pattern to the blocklist
 */
async function addPattern() {
  const pattern = newPatternInputEl.value.trim();
  if (!pattern) {
    showToast('Please enter a pattern', 2000);
    return;
  }
  
  if (blockedPatterns.includes(pattern)) {
    showToast('This pattern is already blocked', 2000);
    newPatternInputEl.value = '';
    return;
  }
  
  blockedPatterns.push(pattern);
  newPatternInputEl.value = '';
  
  try {
    await window.blocklistAPI.setBlockedPatterns(blockedPatterns);
    renderPatterns();
    showToast('Pattern added', 1500);
  } catch (error) {
    console.error('Failed to save pattern:', error);
    showToast('Failed to save pattern', 2000);
    blockedPatterns.pop();
    renderPatterns();
  }
}

/**
 * Remove a pattern from the blocklist
 */
async function removePattern(index) {
  blockedPatterns.splice(index, 1);
  
  try {
    await window.blocklistAPI.setBlockedPatterns(blockedPatterns);
    renderPatterns();
    showToast('Pattern removed', 1500);
  } catch (error) {
    console.error('Failed to remove pattern:', error);
    showToast('Failed to remove pattern', 2000);
    loadBlocklist();
  }
}

/**
 * Block the currently playing song
 */
async function blockCurrentSong() {
  try {
    const result = await window.blocklistAPI.blockCurrentSong();
    if (result.success) {
      showToast(`Blocked: ${result.message || 'Current song'}`, 2000);
      await loadBlocklist();
      await loadHistory();
    } else {
      showToast(result.message || 'Failed to block current song', 2000);
    }
  } catch (error) {
    console.error('Failed to block current song:', error);
    showToast('Failed to block current song', 2000);
  }
}

/**
 * Block the currently playing artist
 */
async function blockCurrentArtist() {
  try {
    const result = await window.blocklistAPI.blockCurrentArtist();
    if (result.success) {
      showToast(`Blocked: ${result.message || 'Current artist'}`, 2000);
      await loadBlocklist();
      await loadHistory();
    } else {
      showToast(result.message || 'Failed to block current artist', 2000);
    }
  } catch (error) {
    console.error('Failed to block current artist:', error);
    showToast('Failed to block current artist', 2000);
  }
}

/**
 * Block track from history
 */
async function blockTrackFromHistory(id) {
  try {
    const result = await window.blocklistAPI.blockTrackFromHistory(id);
    if (result.success) {
      showToast('Song blocked from history', 2000);
      await loadBlocklist();
      await loadHistory();
    } else {
      showToast(result.message || 'Failed to block song', 2000);
    }
  } catch (error) {
    console.error('Failed to block track from history:', error);
    showToast('Failed to block song', 2000);
  }
}

/**
 * Block artist from history
 */
async function blockArtistFromHistory(id) {
  try {
    const result = await window.blocklistAPI.blockArtistFromHistory(id);
    if (result.success) {
      showToast('Artist blocked from history', 2000);
      await loadBlocklist();
      await loadHistory();
    } else {
      showToast(result.message || 'Failed to block artist', 2000);
    }
  } catch (error) {
    console.error('Failed to block artist from history:', error);
    showToast('Failed to block artist', 2000);
  }
}

/**
 * Clear history
 */
async function clearHistory() {
  if (!confirm('Clear all history?')) return;
  
  try {
    await window.blocklistAPI.clearHistory();
    history = [];
    renderHistory();
    showToast('History cleared', 1500);
  } catch (error) {
    console.error('Failed to clear history:', error);
    showToast('Failed to clear history', 2000);
  }
}

/**
 * Reset session stats
 */
async function resetSessionStats() {
  if (!confirm('Reset session statistics?')) return;
  
  try {
    await window.blocklistAPI.resetSessionStats();
    await loadStats();
    showToast('Session stats reset', 1500);
  } catch (error) {
    console.error('Failed to reset session stats:', error);
    showToast('Failed to reset session stats', 2000);
  }
}

/**
 * Reset total stats
 */
async function resetTotalStats() {
  if (!confirm('Reset all-time statistics? This cannot be undone.')) return;
  
  try {
    await window.blocklistAPI.resetTotalStats();
    await loadStats();
    showToast('All-time stats reset', 1500);
  } catch (error) {
    console.error('Failed to reset total stats:', error);
    showToast('Failed to reset total stats', 2000);
  }
}

/**
 * Export blocklist
 */
async function exportBlocklist() {
  try {
    const data = await window.blocklistAPI.exportBlocklist();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swiftbegone-blocklist-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Blocklist exported', 1500);
  } catch (error) {
    console.error('Failed to export blocklist:', error);
    showToast('Failed to export blocklist', 2000);
  }
}

/**
 * Import blocklist
 */
async function importBlocklist() {
  importFileInput.click();
}

/**
 * Handle file import
 */
async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!confirm('Import blocklist? This will replace your current blocklist.')) {
      importFileInput.value = '';
      return;
    }
    
    const result = await window.blocklistAPI.importBlocklist(data);
    if (result.success) {
      showToast('Blocklist imported', 2000);
      await loadBlocklist();
    } else {
      showToast(result.message || 'Failed to import blocklist', 2000);
    }
  } catch (error) {
    console.error('Failed to import blocklist:', error);
    showToast('Failed to import blocklist. Invalid file format.', 3000);
  }
  
  importFileInput.value = '';
}

/**
 * Toggle block collaborations
 */
async function toggleCollabs() {
  blockCollaborations = !blockCollaborations;
  updateToggles();
  
  try {
    await window.blocklistAPI.setBlockCollabs(blockCollaborations);
    showToast(blockCollaborations ? 'Collaborations blocking enabled' : 'Collaborations blocking disabled', 1500);
  } catch (error) {
    console.error('Failed to toggle collabs:', error);
    blockCollaborations = !blockCollaborations;
    updateToggles();
    showToast('Failed to update setting', 2000);
  }
}

/**
 * Toggle reverse mode
 */
async function toggleReverse() {
  reverseMode = !reverseMode;
  updateToggles();
  updateArtistsSectionTitle();
  
  try {
    await window.blocklistAPI.setReverseMode(reverseMode);
    showToast(reverseMode ? 'Reverse mode enabled (whitelist-only)' : 'Reverse mode disabled', 2000);
    await loadBlocklist();
  } catch (error) {
    console.error('Failed to toggle reverse mode:', error);
    reverseMode = !reverseMode;
    updateToggles();
    updateArtistsSectionTitle();
    showToast('Failed to update setting', 2000);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose functions to global scope for onclick handlers
window.removeArtist = removeArtist;
window.removeTrack = removeTrack;
window.removePattern = removePattern;
window.blockTrackFromHistory = blockTrackFromHistory;
window.blockArtistFromHistory = blockArtistFromHistory;

// Event listeners
if (addArtistBtn) addArtistBtn.addEventListener('click', addArtist);
if (addSongBtn) addSongBtn.addEventListener('click', addSong);
if (addPatternBtn) addPatternBtn.addEventListener('click', addPattern);
if (blockCurrentSongBtn) blockCurrentSongBtn.addEventListener('click', blockCurrentSong);
if (blockCurrentArtistBtn) blockCurrentArtistBtn.addEventListener('click', blockCurrentArtist);
if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
if (resetSessionBtn) resetSessionBtn.addEventListener('click', resetSessionStats);
if (resetTotalBtn) resetTotalBtn.addEventListener('click', resetTotalStats);
if (exportBtn) exportBtn.addEventListener('click', exportBlocklist);
if (importBtn) importBtn.addEventListener('click', importBlocklist);
if (importFileInput) importFileInput.addEventListener('change', handleFileImport);

// Toggle listeners
if (collabsToggleLarge) collabsToggleLarge.addEventListener('click', toggleCollabs);
if (reverseToggleLarge) reverseToggleLarge.addEventListener('click', toggleReverse);
if (collabsTogglePatterns) collabsTogglePatterns.addEventListener('click', toggleCollabs);
if (reverseTogglePatterns) reverseTogglePatterns.addEventListener('click', toggleReverse);

// Settings page links
if (githubLink) {
  githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.blocklistAPI.openExternal('https://github.com/swiftbegone/swiftbegonesongskip');
  });
}

if (donateLink) {
  donateLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.blocklistAPI.openExternal('https://buymeacoffee.com/swiftbegone?new=1');
  });
}

if (helpLink) {
  helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.blocklistAPI.openExternal('https://swiftbegone.xyz');
  });
}

// Allow Enter key to trigger add
if (newArtistInputEl) {
  newArtistInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addArtist();
  });
}

if (newSongArtistInputEl) {
  newSongArtistInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') newSongTrackInputEl.focus();
  });
}

if (newSongTrackInputEl) {
  newSongTrackInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSong();
  });
}

if (newPatternInputEl) {
  newPatternInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPattern();
  });
}

// Listen for updates from main process
window.addEventListener('now-playing-updated', (event) => {
  nowPlaying = event.detail;
  updateNowPlaying();
});

window.addEventListener('history-updated', (event) => {
  history = event.detail;
  renderHistory();
});

window.addEventListener('stats-updated', (event) => {
  stats = event.detail;
  renderStats();
  updateDashboardStats();
});

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadBlocklist();
  await loadHistory();
  await loadStats();
  await updateNowPlaying();
  
  // Refresh periodically
  setInterval(updateNowPlaying, 2000);
  setInterval(loadHistory, 3000);
  setInterval(loadStats, 3000);
});

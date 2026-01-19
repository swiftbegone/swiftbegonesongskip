/**
 * Settings window renderer script
 * Handles UI interactions and communicates with main process via preload API
 */

let blockedArtists = [];
let blockedTracks = [];

// DOM elements
const artistsListEl = document.getElementById('artists-list');
const tracksListEl = document.getElementById('tracks-list');
const artistInputEl = document.getElementById('artist-input');
const addArtistBtn = document.getElementById('add-artist-btn');
const trackArtistInputEl = document.getElementById('track-artist-input');
const trackNameInputEl = document.getElementById('track-name-input');
const addTrackBtn = document.getElementById('add-track-btn');
const blockCurrentSongBtn = document.getElementById('block-current-song-btn');
const blockCurrentArtistBtn = document.getElementById('block-current-artist-btn');

/**
 * Load and display current blocklist
 */
async function loadBlocklist() {
  try {
    const data = await window.blocklistAPI.getBlocklist();
    blockedArtists = data.artists || [];
    blockedTracks = data.tracks || [];
    renderArtists();
    renderTracks();
    updateQuickButtons();
  } catch (error) {
    console.error('Failed to load blocklist:', error);
    alert('Failed to load blocklist. Please try again.');
  }
}

/**
 * Render blocked artists list
 */
function renderArtists() {
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
 * Update quick action buttons based on whether music is playing
 */
async function updateQuickButtons() {
  try {
    const nowPlaying = await window.blocklistAPI.getNowPlaying();
    const hasNowPlaying = nowPlaying && nowPlaying.artist && nowPlaying.track;
    
    blockCurrentSongBtn.disabled = !hasNowPlaying;
    blockCurrentArtistBtn.disabled = !hasNowPlaying;
    
    if (hasNowPlaying) {
      blockCurrentSongBtn.title = `Block: ${nowPlaying.track}`;
      const artistName = Array.isArray(nowPlaying.artist) 
        ? nowPlaying.artist.join(', ') 
        : nowPlaying.artist;
      blockCurrentArtistBtn.title = `Block: ${artistName}`;
    } else {
      blockCurrentSongBtn.title = 'No music currently playing';
      blockCurrentArtistBtn.title = 'No music currently playing';
    }
  } catch (error) {
    console.error('Failed to check now playing:', error);
    blockCurrentSongBtn.disabled = true;
    blockCurrentArtistBtn.disabled = true;
  }
}

/**
 * Add an artist to the blocklist
 */
async function addArtist() {
  const artist = artistInputEl.value.trim();
  if (!artist) {
    alert('Please enter an artist name');
    return;
  }
  
  if (blockedArtists.some(a => a.toLowerCase() === artist.toLowerCase())) {
    alert('This artist is already blocked');
    artistInputEl.value = '';
    return;
  }
  
  blockedArtists.push(artist);
  artistInputEl.value = '';
  
  try {
    await window.blocklistAPI.setBlockedArtists(blockedArtists);
    renderArtists();
  } catch (error) {
    console.error('Failed to save artist:', error);
    alert('Failed to save artist. Please try again.');
    blockedArtists.pop(); // Revert on error
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
  } catch (error) {
    console.error('Failed to remove artist:', error);
    alert('Failed to remove artist. Please try again.');
    loadBlocklist(); // Reload on error
  }
}

/**
 * Add a track to the blocklist
 * Artist is optional - if empty, track will match any artist
 */
async function addTrack() {
  const artist = trackArtistInputEl.value.trim();
  const track = trackNameInputEl.value.trim();
  
  if (!track) {
    alert('Please enter a song name');
    return;
  }
  
  // Normalize for comparison
  const normalizedArtist = artist ? artist.toLowerCase().replace(/\s+/g, ' ') : undefined;
  const normalizedTrack = track.toLowerCase().replace(/\s+/g, ' ');
  
  // Check if already blocked
  if (blockedTracks.some(t => {
    const tArtist = t.artist ? t.artist.toLowerCase().replace(/\s+/g, ' ') : undefined;
    const tTrack = t.track.toLowerCase().replace(/\s+/g, ' ');
    return tTrack === normalizedTrack && tArtist === normalizedArtist;
  })) {
    alert('This song is already blocked');
    trackArtistInputEl.value = '';
    trackNameInputEl.value = '';
    return;
  }
  
  // Add track (artist is optional)
  const newTrack = artist ? { artist, track } : { track };
  blockedTracks.push(newTrack);
  trackArtistInputEl.value = '';
  trackNameInputEl.value = '';
  
  try {
    await window.blocklistAPI.setBlockedTracks(blockedTracks);
    renderTracks();
  } catch (error) {
    console.error('Failed to save track:', error);
    alert('Failed to save track. Please try again.');
    blockedTracks.pop(); // Revert on error
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
  } catch (error) {
    console.error('Failed to remove track:', error);
    alert('Failed to remove track. Please try again.');
    loadBlocklist(); // Reload on error
  }
}

/**
 * Block the currently playing song
 */
async function blockCurrentSong() {
  try {
    const result = await window.blocklistAPI.blockCurrentSong();
    if (result.success) {
      alert(`Blocked: ${result.message || 'Current song'}`);
      await loadBlocklist();
    } else {
      alert(result.message || 'Failed to block current song');
    }
  } catch (error) {
    console.error('Failed to block current song:', error);
    alert('Failed to block current song. Please make sure music is playing.');
  }
}

/**
 * Block the currently playing artist
 */
async function blockCurrentArtist() {
  try {
    const result = await window.blocklistAPI.blockCurrentArtist();
    if (result.success) {
      alert(`Blocked: ${result.message || 'Current artist'}`);
      await loadBlocklist();
    } else {
      alert(result.message || 'Failed to block current artist');
    }
  } catch (error) {
    console.error('Failed to block current artist:', error);
    alert('Failed to block current artist. Please make sure music is playing.');
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose functions to global scope for onclick handlers
window.removeArtist = removeArtist;
window.removeTrack = removeTrack;

// Event listeners
addArtistBtn.addEventListener('click', addArtist);
addTrackBtn.addEventListener('click', addTrack);
blockCurrentSongBtn.addEventListener('click', blockCurrentSong);
blockCurrentArtistBtn.addEventListener('click', blockCurrentArtist);

// Allow Enter key to trigger add
artistInputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addArtist();
});

trackArtistInputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    trackNameInputEl.focus();
  }
});

trackNameInputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTrack();
});

// Load blocklist on page load
document.addEventListener('DOMContentLoaded', () => {
  loadBlocklist();
  // Refresh quick buttons every 2 seconds
  setInterval(updateQuickButtons, 2000);
});

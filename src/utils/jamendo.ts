/**
 * Jamendo music service — fetches whistling, acoustic, jazz and lounge tracks
 * and plays them as shuffled background music.
 */

const JAMENDO_CLIENT_ID = '8db8ad8a';
const JAMENDO_API = 'https://api.jamendo.com/v3.0/tracks/';
const MUSIC_TAGS = ['whistling', 'acoustic', 'jazz', 'lounge'];

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  audio: string;
}

interface JamendoResponse {
  results: JamendoTrack[];
}

let audio: HTMLAudioElement | null = null;
let tracks: JamendoTrack[] = [];
let currentIndex = 0;
let isMuted = false;
let defaultVolume = 0.3;
let fetchPromise: Promise<void> | null = null;
let isPlaying = false;

export async function fetchTracks(_tags = 'whistling', limit = 10): Promise<void> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      // Fetch all tag pools in parallel
      const results = await Promise.allSettled(
        MUSIC_TAGS.map(async (tag) => {
          const url = `${JAMENDO_API}?client_id=${JAMENDO_CLIENT_ID}&tags=${tag}&limit=${limit}&format=json&audioformat=mp32`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Jamendo API error: ${res.status}`);
          const data: JamendoResponse = await res.json();
          return data.results.filter((t) => t.audio);
        })
      );

      // Merge, deduplicate by id, shuffle
      const seen = new Set<string>();
      const merged: JamendoTrack[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const track of result.value) {
            if (!seen.has(track.id)) {
              seen.add(track.id);
              merged.push(track);
            }
          }
        }
      }

      tracks = merged.sort(() => Math.random() - 0.5);
      console.log(`[Jamendo] Loaded ${tracks.length} tracks (${MUSIC_TAGS.join(', ')})`);
    } catch (err) {
      console.warn('[Jamendo] Failed to fetch tracks:', err);
    }
  })();

  return fetchPromise;
}

export function playMusic(volume = 0.3): void {
  // If already playing, just update volume and return
  if (isPlaying && audio && !audio.paused) return;

  if (tracks.length === 0) {
    fetchTracks().then(() => playMusic(volume));
    return;
  }

  isPlaying = true;
  defaultVolume = volume;

  if (!audio) {
    audio = new Audio();
    audio.crossOrigin = 'anonymous';

    audio.addEventListener('ended', () => {
      currentIndex = (currentIndex + 1) % tracks.length;
      loadAndPlay();
    });

    audio.addEventListener('error', () => {
      console.warn('[Jamendo] Track error, skipping...');
      currentIndex = (currentIndex + 1) % tracks.length;
      loadAndPlay();
    });
  }

  loadAndPlay();
}

function loadAndPlay(): void {
  if (!audio || tracks.length === 0) return;
  const track = tracks[currentIndex];
  if (!track?.audio) return;

  audio.src = track.audio;
  audio.volume = isMuted ? 0 : defaultVolume;
  audio.load();

  audio.play().catch((err) => {
    console.warn('[Jamendo] Autoplay blocked:', err.message);
  });
}

export function stopMusic(): void {
  if (!audio) return;
  audio.pause();
  audio.src = '';
  audio = null;
  isPlaying = false;
  // Keep fetchPromise and tracks so resuming doesn't require a full re-fetch
}

export function pauseMusic(): void {
  if (audio && !audio.paused) audio.pause();
  isPlaying = false;
}

export function resumeMusic(): void {
  if (isPlaying) return;
  if (audio && audio.paused && audio.src) {
    isPlaying = true;
    audio.play().catch(() => {});
  } else {
    playMusic(defaultVolume);
  }
}

export function setMusicMuted(muted: boolean): void {
  isMuted = muted;
  if (audio) {
    audio.volume = muted ? 0 : defaultVolume;
    if (!muted && audio.paused && tracks.length > 0) {
      audio.play().catch(() => {});
    }
  }
}

export function setMusicVolume(volume: number): void {
  defaultVolume = Math.max(0, Math.min(1, volume));
  if (audio) {
    audio.volume = defaultVolume;
    if (defaultVolume === 0 && !audio.paused) {
      audio.pause();
      isPlaying = false;
    } else if (defaultVolume > 0 && audio.paused && audio.src) {
      isPlaying = true;
      audio.play().catch(() => {});
    }
  }
}

export function getMusicVolume(): number {
  return defaultVolume;
}

export function skipTrack(): void {
  if (tracks.length === 0) return;
  currentIndex = (currentIndex + 1) % tracks.length;
  loadAndPlay();
}

export function getCurrentTrack(): JamendoTrack | null {
  return tracks[currentIndex] ?? null;
}

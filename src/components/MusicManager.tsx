import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { fetchTracks, playMusic, pauseMusic, resumeMusic, stopMusic, isJamendoPlaying } from '../utils/jamendo';
import { startAmbient, stopAmbient } from '../utils/audio';

function unlockAudioContext(): Promise<void> {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return Promise.resolve();
    const ctx = new AC();
    return ctx.resume().then(() => ctx.close()).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

export default function MusicManager() {
  const musicEnabled = useSettingsStore((s) => s.settings.musicEnabled);
  const firstGestureRef = useRef(false);

  // Preload tracks on mount so playback is ready when the user interacts
  useEffect(() => {
    // Preload the default hip-hop / RnB track pool
    void fetchTracks(undefined, 12);
  }, []);

  // If the user toggles music in settings, start/stop accordingly
  useEffect(() => {
    if (musicEnabled) {
      // Try to resume if user already interacted; otherwise wait for gesture
      if (firstGestureRef.current) {
        try { resumeMusic(); } catch { void playMusic(0.3); }
      }
    } else {
      pauseMusic();
    }
  }, [musicEnabled]);

  // Listen for first user gesture to satisfy autoplay policy
  useEffect(() => {
    async function onFirstGesture() {
      if (firstGestureRef.current) return;
      firstGestureRef.current = true;
      // Try to unlock AudioContext within the user gesture to satisfy autoplay policies
      await unlockAudioContext();
      console.debug('[MusicManager] first user gesture detected, attempting playback');
      // Start a gentle ambient fallback immediately so the user hears audio even if remote tracks are blocked
      try {
        startAmbient(0.02);
      } catch (e) {
        console.warn('[MusicManager] ambient start failed', e);
      }

      try {
        if (musicEnabled) {
          void playMusic(0.28);

          // Poll briefly to detect if Jamendo started; if it does, stop ambient fallback
          const start = Date.now();
          const iv = setInterval(() => {
            if (isJamendoPlaying()) {
              try { stopAmbient(); } catch {};
              clearInterval(iv);
            } else if (Date.now() - start > 3000) {
              // After 3s of no Jamendo playback, keep ambient running as fallback
              clearInterval(iv);
            }
          }, 250);
        }
      } catch (e) {
        console.warn('[MusicManager] play attempt failed', e);
      }
    }

    window.addEventListener('click', onFirstGesture, { once: true });
    window.addEventListener('keydown', onFirstGesture, { once: true });

    return () => {
      // Not strictly necessary as listeners are once: true, but be tidy
      window.removeEventListener('click', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      stopMusic();
    };
  }, [musicEnabled]);

  return null;
}

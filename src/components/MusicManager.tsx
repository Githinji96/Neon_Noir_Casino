import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { fetchTracks, pauseMusic, resumeMusic, stopMusic } from '../utils/jamendo';
import { useLocation } from 'react-router-dom';

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
  const location = useLocation();
  const isSlotPage = location.pathname.startsWith('/slot');

  // Preload tracks on mount so playback is ready when the user interacts
  useEffect(() => {
    // Preload the default hip-hop / RnB track pool
    void fetchTracks(undefined, 12);
  }, []);

  // Manage playback only on the slot page.
  // Pause when leaving slot pages, even if music is still enabled globally.
  useEffect(() => {
    if (!firstGestureRef.current) return;

    if (musicEnabled && isSlotPage) {
      try {
        resumeMusic();
      } catch {
        /* no-op */
      }
    } else {
      pauseMusic();
    }
  }, [musicEnabled, isSlotPage]);

  // Listen for first user gesture to satisfy autoplay policy
  useEffect(() => {
    async function onFirstGesture() {
      if (firstGestureRef.current) return;
      firstGestureRef.current = true;
      // Try to unlock AudioContext within the user gesture to satisfy autoplay policies.
      await unlockAudioContext();
      console.debug('[MusicManager] first user gesture detected, audio unlocked');
      if (musicEnabled) {
        void fetchTracks(undefined, 12);
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

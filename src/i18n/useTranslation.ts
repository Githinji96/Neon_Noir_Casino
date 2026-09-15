import { useSettingsStore } from '../store/settingsStore';
import { TRANSLATIONS, type Locale, type Translations } from './translations';

/**
 * Returns the full translation object for the current language setting.
 * Falls back to English for any unknown locale.
 *
 * Usage:
 *   const t = useTranslation();
 *   <button>{t.slot_spin}</button>
 */
export function useTranslation(): Translations {
  const language = useSettingsStore((s) => s.settings.language) as Locale;
  return TRANSLATIONS[language] ?? TRANSLATIONS.en;
}

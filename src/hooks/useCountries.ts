import { useEffect, useState } from 'react';

export interface CountryOption {
  value: string;   // ISO 3166-1 alpha-2 code
  label: string;   // Common name
  flag: string;    // Emoji flag
  currency?: string; // Primary currency code
}

// Module-level cache — survives component remounts within the same browser session.
// The country list is static; fetching it once per session is sufficient.
let _cached: CountryOption[] | null = null;
let _fetchPromise: Promise<CountryOption[]> | null = null;

function fetchCountries(): Promise<CountryOption[]> {
  if (_cached) return Promise.resolve(_cached);
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flag,currencies')
    .then((r) => r.json())
    .then((data: any[]) => {
      const parsed: CountryOption[] = data
        .map((c) => ({
          value: c.cca2,
          label: c.name.common,
          flag: c.flag ?? '',
          currency: c.currencies ? Object.keys(c.currencies)[0] : undefined,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      _cached = parsed;
      _fetchPromise = null;
      return parsed;
    })
    .catch(() => {
      _fetchPromise = null;
      return [] as CountryOption[]; // Fallback to empty — user can still type
    });

  return _fetchPromise;
}

export function useCountries() {
  // If already cached, initialise synchronously — no loading flash
  const [countries, setCountries] = useState<CountryOption[]>(_cached ?? []);
  const [loading, setLoading] = useState(_cached === null);

  useEffect(() => {
    if (_cached) {
      setCountries(_cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchCountries().then((data) => {
      if (!cancelled) {
        setCountries(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { countries, loading };
}

import { useEffect, useState } from 'react';

export interface CountryOption {
  value: string;   // ISO 3166-1 alpha-2 code
  label: string;   // Common name
  flag: string;    // Emoji flag
  currency?: string; // Primary currency code
}

export function useCountries() {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flag,currencies')
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
        setCountries(parsed);
      })
      .catch(() => {
        // Fallback to empty — user can still type
      })
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading };
}

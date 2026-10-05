import { useEffect, useState } from 'react';
import type { School } from '../types';
import { listSchools } from './api';

let cache: Map<string, School> | null = null;

/** All schools for the season, keyed by id. Loaded once per app session. */
export function useSchools(): Map<string, School> {
  const [schools, setSchools] = useState<Map<string, School>>(cache ?? new Map());
  useEffect(() => {
    if (cache) return;
    listSchools().then((list) => {
      cache = new Map(list.map((s) => [s.id, s]));
      setSchools(cache);
    });
  }, []);
  return schools;
}

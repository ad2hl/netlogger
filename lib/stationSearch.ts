import { Station } from '@/types';

function createWildcardMatcher(query: string): (text: string) => boolean {
  const normalizedQuery = query.toLowerCase();

  // If query contains ?, convert to regex pattern where ? matches zero or more characters
  if (normalizedQuery.includes('?')) {
    // Escape regex special characters except ?, then replace ? with .*
    const pattern = normalizedQuery
      .replace(/[.*+^${}()|[\]\\]/g, '\\$&')
      .replace(/\?/g, '.*');
    const regex = new RegExp(pattern);
    return (text: string) => regex.test(text.toLowerCase());
  }

  // Otherwise use simple includes
  return (text: string) => text.toLowerCase().includes(normalizedQuery);
}

export function searchStations(stations: Station[], query: string): Station[] {
  if (!query.trim()) {
    return [];
  }

  const matches = createWildcardMatcher(query);

  const results = stations.filter((station) => {
    return (
      matches(station.callsign) ||
      matches(station.firstName || '') ||
      matches(station.nickname || '') ||
      matches(station.city || '') ||
      matches(station.state || '')
    );
  });

  // Return first 10 matches (already ordered by lastSeen from the query)
  return results.slice(0, 10);
}

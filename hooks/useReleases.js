import { useState, useCallback } from 'react';
import { fetchReleases } from '../services/githubService';

export const useReleases = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getReleases = useCallback(async (owner, repo, token = null) => {
    if (!owner || !repo) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReleases(owner, repo, token);
      setReleases(data);
    } catch (err) {
      setError(err.message);
      setReleases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { releases, loading, error, getReleases };
};

'use client';

import { useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { ME } from '@/lib/queries';
import { clearTokens, isAuthenticated } from '@/lib/auth';
import type { User } from '@/lib/types';

/** Tracks the authenticated viewer. Re-reads on auth-changed events. */
export function useAuth() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
    const onChange = () => setAuthed(isAuthenticated());
    window.addEventListener('auth-changed', onChange);
    return () => window.removeEventListener('auth-changed', onChange);
  }, []);

  const { data, loading, refetch } = useQuery<{ me: User | null }>(ME, {
    skip: !authed,
    fetchPolicy: 'cache-and-network',
  });

  const logout = () => {
    clearTokens();
    setAuthed(false);
  };

  return {
    user: authed ? data?.me ?? null : null,
    isAuthenticated: authed,
    loading: authed && loading,
    refetch,
    logout,
  };
}

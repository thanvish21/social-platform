'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { LOGOUT } from '@/lib/queries';

export function Nav() {
  const { user, isAuthenticated, logout } = useAuth();
  const [logoutMutation] = useMutation(LOGOUT);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logoutMutation();
    } catch {
      /* best-effort */
    }
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-black/80">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-extrabold text-brand">
            ◎ Sociable
          </Link>
          <Link href="/" className="hidden text-sm font-semibold hover:text-brand sm:block">
            Home
          </Link>
          <Link href="/explore" className="hidden text-sm font-semibold hover:text-brand sm:block">
            Explore
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <NotificationBell />
              {user && (
                <Link href={`/${user.handle}`} className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${user.handle}`}
                    alt={user.displayName}
                    className="h-8 w-8 rounded-full bg-gray-200 object-cover"
                  />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

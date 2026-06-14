'use client';

import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

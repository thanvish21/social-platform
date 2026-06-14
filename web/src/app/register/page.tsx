'use client';

import { useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { REGISTER } from '@/lib/queries';
import { setTokens } from '@/lib/auth';
import type { AuthPayload } from '@/lib/types';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: '', handle: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [register, { loading }] = useMutation<{ register: AuthPayload }>(REGISTER);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await register({ variables: form });
      if (data?.register) {
        setTokens(data.register.accessToken, data.register.refreshToken);
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <form onSubmit={submit} className="space-y-4">
        <input
          required
          placeholder="Display name"
          value={form.displayName}
          onChange={update('displayName')}
          className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 outline-none focus:border-brand dark:border-gray-700"
        />
        <input
          required
          placeholder="Handle (a-z, 0-9, _)"
          value={form.handle}
          onChange={update('handle')}
          className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 outline-none focus:border-brand dark:border-gray-700"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={update('email')}
          className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 outline-none focus:border-brand dark:border-gray-700"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 chars)"
          value={form.password}
          onChange={update('password')}
          className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 outline-none focus:border-brand dark:border-gray-700"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

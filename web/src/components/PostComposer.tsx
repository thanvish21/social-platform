'use client';

import { useMutation, useQuery } from '@apollo/client';
import { useRef, useState } from 'react';
import {
  CREATE_POST,
  REQUEST_MEDIA_UPLOAD,
  TRENDING_HASHTAGS,
  FEED,
} from '@/lib/queries';
import type { Hashtag, PresignedUpload } from '@/lib/types';

const MAX_CHARS = 500;

export function PostComposer() {
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: trending } = useQuery<{ trendingHashtags: Hashtag[] }>(TRENDING_HASHTAGS, {
    variables: { limit: 8 },
  });

  const [createPost, { loading }] = useMutation(CREATE_POST, {
    refetchQueries: [{ query: FEED, variables: { first: 20 } }],
  });
  const [requestUpload] = useMutation<{ requestMediaUpload: PresignedUpload }>(
    REQUEST_MEDIA_UPLOAD,
  );

  const remaining = MAX_CHARS - content.length;
  const overLimit = remaining < 0;

  // Show hashtag suggestions when the caret is in a fresh "#word".
  const onChange = (value: string) => {
    if (value.length <= MAX_CHARS) setContent(value);
    const match = /#([\p{L}0-9_]*)$/u.test(value);
    setShowTags(match);
  };

  const insertTag = (tag: string) => {
    setContent((prev) => prev.replace(/#([\p{L}0-9_]*)$/u, `#${tag} `));
    setShowTags(false);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await requestUpload({ variables: { contentType: file.type } });
      const upload = data?.requestMediaUpload;
      if (!upload) throw new Error('No upload target');

      const form = new FormData();
      for (const { key, value } of upload.fields) form.append(key, value);
      form.append('file', file);

      const res = await fetch(upload.url, { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      setMediaUrl(upload.publicUrl);
    } catch (err) {
      console.error(err);
      alert('Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if ((!content.trim() && !mediaUrl) || overLimit) return;
    await createPost({
      variables: {
        content: content.trim(),
        mediaUrls: mediaUrl ? [mediaUrl] : [],
      },
    });
    setContent('');
    setMediaUrl(null);
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 p-4">
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What's happening?"
        rows={3}
        className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-gray-500"
      />

      {showTags && (trending?.trendingHashtags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2 py-2">
          {trending!.trendingHashtags.map((h) => (
            <button
              key={h.id}
              onClick={() => insertTag(h.tag)}
              className="rounded-full bg-gray-200 dark:bg-gray-800 px-3 py-1 text-sm hover:bg-brand hover:text-white"
            >
              #{h.tag}
            </button>
          ))}
        </div>
      )}

      {mediaUrl && (
        <div className="relative mt-2 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl} alt="preview" className="max-h-60 rounded-xl" />
          <button
            onClick={() => setMediaUrl(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2 text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-brand hover:opacity-80"
            disabled={uploading}
          >
            {uploading ? '⏳' : '🖼️'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm ${overLimit ? 'text-red-500' : 'text-gray-500'}`}>
            {remaining}
          </span>
          <button
            onClick={submit}
            disabled={loading || overLimit || (!content.trim() && !mediaUrl)}
            className="rounded-full bg-brand px-5 py-1.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

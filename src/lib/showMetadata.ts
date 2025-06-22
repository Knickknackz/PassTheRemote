import { createPortal } from 'react-dom';
import { supabase } from './supabaseClient'; // adjust path as needed

export async function fetchShowMetadata(title: string) {
  // Step 1: Check cache
  const { data: cached, error: readError } = await supabase
    .from('show_metadata')
    .select('*')
    .ilike('title', title)
    .maybeSingle();

  const isExpired = !cached?.expires_at || new Date(cached.expires_at) < new Date();
  console.log("expire",isExpired);
  if (cached && !readError && !isExpired) {
    return { ...cached, source: 'cache' };
  }

  // Step 2: Fetch from Edge Function
  const res = await fetch('https://gzloumyomschdfkyqwed.supabase.co/functions/v1/get-show-metadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-extension-auth': 'reactr-ftw-82364'
    },
    body: JSON.stringify({ title })
  });

  const meta = await res.json();

  // Step 3: Save to Supabase if found
  if (meta?.found) {
    const { error: insertError } = await supabase
      .from('show_metadata')
      .upsert({
        title,
        year: meta.year,
        overview: meta.overview,
        posters: meta.posters, // 👈 add this
        expires_at: meta.expires_at,
        source_platforms: meta.streaming || []
      }, { onConflict: ['title', 'year'] });

    if (insertError) console.error('❌ Failed to cache metadata:', insertError.message);

    return { ...meta, source: 'fresh' };
  }

  return { found: false };
}
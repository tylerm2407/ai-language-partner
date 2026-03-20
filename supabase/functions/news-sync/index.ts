// Supabase Edge Function: News Sync
// Fetches RSS feeds for language learning news, summarizes via Claude Haiku,
// and upserts into news_articles table. Designed to be called by a cron/scheduler.
// Deploy: npx supabase functions deploy news-sync

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// RSS feed sources by language code
const RSS_FEEDS: Record<string, { url: string; name: string }> = {
  es: { url: 'https://www.bbc.com/mundo/index.xml', name: 'BBC Mundo' },
  fr: { url: 'https://www.france24.com/fr/rss', name: 'France24' },
  ja: { url: 'https://www3.nhk.or.jp/nhkworld/en/news/list.xml', name: 'NHK World' },
};

interface FeedArticle {
  title: string;
  link: string;
  published: string;
  language: string;
  source: string;
}

/**
 * Parse an RSS/Atom XML feed and extract articles.
 * Uses simple regex parsing to avoid XML library dependencies in Deno.
 */
function parseFeed(xml: string, language: string, source: string): FeedArticle[] {
  const articles: FeedArticle[] = [];

  // Match <item> blocks (RSS) or <entry> blocks (Atom)
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2];

    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>|<link[^>]*href="([^"]*)"[^>]*\/?>/i);
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>|<published>([\s\S]*?)<\/published>|<dc:date>([\s\S]*?)<\/dc:date>/i);

    const title = (titleMatch?.[1] ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    const link = (linkMatch?.[1] || linkMatch?.[2] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    const published = (dateMatch?.[1] || dateMatch?.[2] || dateMatch?.[3] || '').trim();

    if (title && link) {
      articles.push({
        title,
        link,
        published: published || new Date().toISOString(),
        language,
        source,
      });
    }
  }

  return articles;
}

/**
 * Generate a 2-3 sentence summary of an article title using Claude Haiku.
 */
async function summarizeArticle(title: string, language: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return '';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: 200,
      system: `You summarize news articles for language learners. Write a 2-3 sentence summary in ${language} that is simple enough for intermediate learners. Only return the summary, no preamble.`,
      messages: [
        { role: 'user', content: `Summarize this news headline for language learners: "${title}"` },
      ],
    }),
  });

  if (!response.ok) return '';

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let totalSynced = 0;

    for (const [language, feed] of Object.entries(RSS_FEEDS)) {
      // Fetch RSS feed
      let xml: string;
      try {
        const feedResponse = await fetch(feed.url);
        if (!feedResponse.ok) continue;
        xml = await feedResponse.text();
      } catch {
        // Skip feeds that fail to fetch
        continue;
      }

      const articles = parseFeed(xml, language, feed.name);

      for (const article of articles) {
        // Generate AI summary
        const summary = await summarizeArticle(article.title, language);

        // Upsert into news_articles, dedup by url
        const { error } = await supabase
          .from('news_articles')
          .upsert(
            {
              url: article.link,
              title: article.title,
              published_at: article.published,
              language: article.language,
              source: article.source,
              summary,
              synced_at: new Date().toISOString(),
            },
            { onConflict: 'url' }
          );

        if (!error) totalSynced++;
      }
    }

    return new Response(
      JSON.stringify({ synced: totalSynced }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

import { supabase } from './supabase';

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

export async function searchWikisourceTexts(
  language: string,
  query: string
): Promise<WikiSearchResult[]> {
  const url = `https://${language}.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikisource API error: ${response.status}`);

  const data = await response.json();
  return (data.query?.search ?? []).map((r: any) => ({
    title: r.title,
    snippet: r.snippet?.replace(/<[^>]*>/g, '') ?? '',
    pageid: r.pageid,
  }));
}

export async function fetchWikisourceText(
  language: string,
  pageTitle: string
): Promise<string> {
  const url = `https://${language}.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&origin=*`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch Wikisource page: ${pageTitle}`);

  const data = await response.json();
  const wikitext = data.parse?.wikitext?.['*'] ?? '';

  return stripWikiMarkup(wikitext);
}

function stripWikiMarkup(wikitext: string): string {
  let text = wikitext;
  // Remove templates {{...}}
  text = text.replace(/\{\{[^}]*\}\}/g, '');
  // Remove categories [[Category:...]]
  text = text.replace(/\[\[(?:Category|Categoría|Catégorie|Kategorie):.*?\]\]/gi, '');
  // Convert wiki links [[text|display]] to display, [[text]] to text
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
  // Remove bold/italic markers
  text = text.replace(/'{2,5}/g, '');
  // Remove section headers (== Header ==)
  text = text.replace(/^={2,}\s*(.+?)\s*={2,}$/gm, '\n$1\n');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Remove references <ref>...</ref>
  text = text.replace(/<ref[^>]*>.*?<\/ref>/gs, '');
  text = text.replace(/<ref[^>]*\/>/g, '');
  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

export async function ingestWikisourceText(
  language: string,
  pageTitle: string,
  cefrLevel: string
): Promise<{ id: string }> {
  const content = await fetchWikisourceText(language, pageTitle);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  const { data, error } = await supabase
    .from('reading_books')
    .insert({
      source: 'wikisource',
      source_id: pageTitle,
      language,
      cefr_level: cefrLevel,
      title: pageTitle.replace(/_/g, ' '),
      author: null,
      description: `From Wikisource (${language}).`,
      content,
      word_count: wordCount,
      chapter_breaks: [],
      tags: ['wikisource'],
      is_published: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id };
}

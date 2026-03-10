import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stub news data — replace with real RSS feeds per language
// PLUG IN: Use fetch() to pull from these RSS feeds in production:
//   Spanish: https://feeds.bbci.co.uk/mundo/rss.xml or https://rss.nytimes.com/services/xml/rss/nyt/World.xml
//   French: https://www.france24.com/fr/rss
//   Japanese: https://www3.nhk.or.jp/rss/news/cat0.xml
const STUB_NEWS: Record<string, any[]> = {
  es: [
    { title: "La tecnologia transforma la educacion moderna", source_name: "El Pais (stub)", url: "https://elpais.com", summary: "Las nuevas tecnologias estan cambiando la forma en que aprendemos, con inteligencia artificial y plataformas digitales liderando el cambio.", difficulty: "B1" },
    { title: "Record de turistas en Espana este verano", source_name: "El Mundo (stub)", url: "https://elmundo.es", summary: "Espana registro un numero historico de visitantes internacionales durante el verano, con un aumento del 15% respecto al ano anterior.", difficulty: "A2" },
    { title: "Nuevas investigaciones sobre cambio climatico", source_name: "ABC (stub)", url: "https://abc.es", summary: "Cientificos presentan datos alarmantes sobre el aumento de temperaturas globales y sus efectos en los ecosistemas mediterraneos.", difficulty: "B2" },
  ],
  fr: [
    { title: "L'intelligence artificielle revolutionne la medecine", source_name: "Le Monde (stub)", url: "https://lemonde.fr", summary: "De nouveaux outils d'IA permettent aux medecins de diagnostiquer les maladies avec une precision sans precedent.", difficulty: "B1" },
    { title: "Le tourisme en France bat des records", source_name: "Le Figaro (stub)", url: "https://lefigaro.fr", summary: "Paris accueille plus de 50 millions de touristes par an, renforcant sa position comme capitale mondiale du tourisme.", difficulty: "A2" },
  ],
  ja: [
    { title: "Japan technology innovation leads the world", source_name: "NHK (stub)", url: "https://nhk.or.jp", summary: "Japanese companies continue global innovation in robotics and artificial intelligence.", difficulty: "B1" },
    { title: "Tokyo visitor count reaches all-time high", source_name: "Asahi Shimbun (stub)", url: "https://asahi.com", summary: "The number of foreign tourists visiting Japan in 2024 reached an all-time high, contributing to the inbound economy.", difficulty: "A2" },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && !authHeader.includes(cronSecret)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: languages } = await supabase.from("languages").select("id, code").eq("is_active", true);
    if (!languages) throw new Error("No languages found");

    let totalInserted = 0;
    for (const lang of languages) {
      const articles = STUB_NEWS[lang.code];
      if (!articles) continue;

      for (const article of articles) {
        const { count } = await supabase.from("news_articles")
          .select("*", { count: "exact", head: true })
          .eq("language_id", lang.id).eq("title", article.title)
          .gte("created_at", new Date(Date.now() - 86400000).toISOString());

        if (count && count > 0) continue;

        await supabase.from("news_articles").insert({
          language_id: lang.id,
          title: article.title,
          source_name: article.source_name,
          url: article.url,
          summary: article.summary,
          difficulty: article.difficulty,
          published_at: new Date().toISOString(),
          metadata: { stub: true },
        });
        totalInserted++;
      }
    }

    return new Response(JSON.stringify({ success: true, inserted: totalInserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, jsonResponse, errorResponse, log, HttpError, getAdminClient, verifyCronAuth,
} from "../_shared/middleware.ts";

const FN = "news-sync";

const STUB_NEWS: Record<string, Array<{ title: string; source_name: string; url: string; summary: string; difficulty: string }>> = {
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
    { title: "\u65E5\u672C\u306E\u30C6\u30AF\u30CE\u30ED\u30B8\u30FC\u30A4\u30CE\u30D9\u30FC\u30B7\u30E7\u30F3\u304C\u4E16\u754C\u3092\u30EA\u30FC\u30C9", source_name: "NHK (stub)", url: "https://nhk.or.jp", summary: "\u65E5\u672C\u4F01\u696D\u306F\u30ED\u30DC\u30C6\u30A3\u30AF\u30B9\u3068AI\u306E\u5206\u91CE\u3067\u4E16\u754C\u7684\u306A\u30A4\u30CE\u30D9\u30FC\u30B7\u30E7\u30F3\u3092\u7D9A\u3051\u3066\u3044\u307E\u3059\u3002", difficulty: "B1" },
    { title: "\u6771\u4EAC\u306E\u8A2A\u554F\u8005\u6570\u304C\u904E\u53BB\u6700\u9AD8\u3092\u8A18\u9332", source_name: "\u671D\u65E5\u65B0\u805E (stub)", url: "https://asahi.com", summary: "2024\u5E74\u306B\u65E5\u672C\u3092\u8A2A\u308C\u305F\u5916\u56FD\u4EBA\u65C5\u884C\u8005\u306E\u6570\u304C\u904E\u53BB\u6700\u9AD8\u3092\u66F4\u65B0\u3057\u3001\u30A4\u30F3\u30D0\u30A6\u30F3\u30C9\u7D4C\u6E08\u306B\u8CA2\u732E\u3057\u3066\u3044\u307E\u3059\u3002", difficulty: "A2" },
  ],
};

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    verifyCronAuth(req);

    const db = getAdminClient();
    const { data: languages } = await db.from("languages").select("id, code").eq("is_active", true);
    if (!languages) throw new HttpError(500, "No languages found");

    let totalInserted = 0;
    for (const lang of languages) {
      const articles = STUB_NEWS[lang.code];
      if (!articles) continue;

      for (const article of articles) {
        const { count } = await db.from("news_articles")
          .select("*", { count: "exact", head: true })
          .eq("language_id", lang.id)
          .eq("title", article.title)
          .gte("created_at", new Date(Date.now() - 86400000).toISOString());

        if (count && count > 0) continue;

        await db.from("news_articles").insert({
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

    log(FN, "sync_complete", { inserted: totalInserted });
    return jsonResponse({ success: true, inserted: totalInserted });

  } catch (err) {
    return errorResponse(err);
  }
});

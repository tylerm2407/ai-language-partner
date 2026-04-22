import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { fetchGrammarRules } from '../../lib/supabase-queries';
import type { GrammarRule } from '../../types';

interface RuleCardProps {
  /** Exact rule_name to look up. Prefer this if known. */
  ruleName?: string | null;
  /** Fallback lookup key (usually exercise.targetGrammar). */
  targetGrammar?: string | null;
  /** Language code (e.g. 'es'). Required for the lookup. */
  language: string;
  /** CEFR level. Defaults to 'A1' if not provided. */
  cefrLevel?: string;
}

interface Example {
  target?: string;
  native?: string;
  sentence?: string;
  translation?: string;
}

/**
 * Surfaces a `grammar_rules` row (migration 017) when a learner makes a
 * grammar or lexical error. Fails silently if no matching rule exists so the
 * feedback UX always degrades gracefully (research.md §10 — do not block
 * elicitation on missing content).
 */
export function RuleCard({ ruleName, targetGrammar, language, cefrLevel }: RuleCardProps) {
  const [rule, setRule] = useState<GrammarRule | null>(null);
  const [loading, setLoading] = useState(true);

  const lookupKey = ruleName ?? targetGrammar ?? null;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!lookupKey) {
        setLoading(false);
        return;
      }
      try {
        const rules = await fetchGrammarRules(language, cefrLevel ?? 'A1');
        if (cancelled) return;

        // Exact match first.
        let found = rules.find(
          (r) => r.ruleName?.toLowerCase() === lookupKey.toLowerCase()
        );
        // Fuzzy contains fallback.
        if (!found) {
          const needle = lookupKey.toLowerCase();
          found = rules.find(
            (r) =>
              r.ruleName?.toLowerCase().includes(needle) ||
              needle.includes(r.ruleName?.toLowerCase() ?? '')
          );
        }
        setRule(found ?? null);
      } catch (err) {
        // Fail silently per design — no card beats a broken card.
        console.warn('[RuleCard] fetchGrammarRules failed:', err);
        setRule(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();

    return () => {
      cancelled = true;
    };
  }, [lookupKey, language, cefrLevel]);

  if (loading || !rule) return null;

  const examples = parseExamples(rule.examples).slice(0, 2);
  const explanation = truncateWords(rule.explanation ?? '', 60);

  return (
    <View className="bg-dark-card rounded-[20px] p-6 mt-3 border border-white/10">
      <Text
        className="text-primary font-sans-bold text-base mb-2"
        accessibilityRole="header"
      >
        {rule.title || rule.ruleName}
      </Text>
      {explanation ? (
        <Text className="text-text-primary text-[15px] leading-6 mb-3">
          {explanation}
        </Text>
      ) : null}
      {examples.length > 0 && (
        <View className="mt-1">
          {examples.map((ex, i) => (
            <View key={i} className="mb-2">
              <Text className="text-text-primary text-[14px] font-sans-semibold">
                {ex.target ?? ex.sentence ?? ''}
              </Text>
              {(ex.native ?? ex.translation) ? (
                <Text className="text-text-secondary text-[13px] italic">
                  {ex.native ?? ex.translation}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function parseExamples(raw: unknown): Example[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { sentence: item };
      if (item && typeof item === 'object') return item as Example;
      return null;
    })
    .filter((x): x is Example => x !== null);
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

import { Fragment } from 'react';
import { Text } from 'react-native';

interface HighlightedTextProps {
  text: string;
  /**
   * Optional substring to highlight. Matching is case-insensitive. If empty
   * or undefined, renders `text` unchanged.
   */
  highlight?: string | null;
  /**
   * Classes for the parent Text (size, color, etc.). The highlighted spans
   * will render bold + primary-accent colored while inheriting everything
   * else (font-size, line-height) from the parent.
   */
  className?: string;
}

/**
 * Case-insensitive highlight of a substring inside a Text block — used by
 * exercise prompts to visually emphasize the target word or target grammar
 * form (Schmidt's noticing hypothesis, research.md §4).
 *
 * Regex-unsafe chars in `highlight` are escaped before building the regex.
 */
export function HighlightedText({ text, highlight, className }: HighlightedTextProps) {
  if (!highlight || highlight.trim().length === 0) {
    return <Text className={className}>{text}</Text>;
  }

  const escaped = escapeRegExp(highlight.trim());
  let re: RegExp;
  try {
    re = new RegExp(`(${escaped})`, 'ig');
  } catch {
    // Defensive: if the pattern somehow still breaks the engine, fall
    // back to plain text.
    return <Text className={className}>{text}</Text>;
  }

  const parts = text.split(re);

  return (
    <Text className={className}>
      {parts.map((part, i) => {
        // Even-indexed parts are non-matches; odd are matches.
        const isMatch = i % 2 === 1;
        if (!isMatch) return <Fragment key={i}>{part}</Fragment>;
        return (
          <Text key={i} className="font-sans-bold text-primary">
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

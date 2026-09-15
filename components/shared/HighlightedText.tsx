import { Fragment } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface HighlightedTextProps {
  text: string;
  /**
   * Optional substring to highlight. Matching is case-insensitive. If empty
   * or undefined, renders `text` unchanged.
   */
  highlight?: string | null;
  /**
   * Classes for the parent Text (size, weight). The highlighted spans render
   * bold in the accent colour while inheriting everything else (font-size,
   * line-height) from the parent.
   */
  className?: string;
  /**
   * Colour for the parent Text. UI 2.0 colour comes from `useUi2Theme()`, so
   * it cannot travel in a className the way `text-text-primary` used to.
   */
  style?: StyleProp<TextStyle>;
}

/**
 * Case-insensitive highlight of a substring inside a Text block — used by
 * exercise prompts to visually emphasize the target word or target grammar
 * form (Schmidt's noticing hypothesis, research.md §4).
 *
 * Regex-unsafe chars in `highlight` are escaped before building the regex.
 */
export function HighlightedText({ text, highlight, className, style }: HighlightedTextProps) {
  const { c } = useUi2Theme();
  if (!highlight || highlight.trim().length === 0) {
    return <Text className={className} style={style}>{text}</Text>;
  }

  const escaped = escapeRegExp(highlight.trim());
  let re: RegExp;
  try {
    re = new RegExp(`(${escaped})`, 'ig');
  } catch {
    // Defensive: if the pattern somehow still breaks the engine, fall
    // back to plain text.
    return <Text className={className} style={style}>{text}</Text>;
  }

  const parts = text.split(re);

  return (
    <Text className={className} style={style}>
      {parts.map((part, i) => {
        // Even-indexed parts are non-matches; odd are matches.
        const isMatch = i % 2 === 1;
        if (!isMatch) return <Fragment key={i}>{part}</Fragment>;
        return (
          <Text key={i} className="font-sans-bold" style={{ color: c.primary }}>
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

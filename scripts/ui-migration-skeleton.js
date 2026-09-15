/**
 * Extract a file's BEHAVIOURAL skeleton, ignoring anything cosmetic.
 *
 * A UI migration is supposed to change styling and nothing else. Eyeballing a
 * 1,237-line diff cannot establish that. This walks the TypeScript AST and
 * emits only the things that can change RUNTIME BEHAVIOUR:
 *
 *   - every hook call's arguments (useEffect / useCallback / useMemo /
 *     useState / useRef), which is where state, effects and dependency arrays
 *     live
 *   - every function declaration body
 *   - every JSX attribute EXCEPT the cosmetic ones, so an inline onPress or an
 *     accessibilityLabel is captured while a style prop is not
 *
 * Deliberately ignored: imports, StyleSheet.create, and style/colour props.
 * Those are exactly what the migration is allowed to touch.
 */
const ts = require('typescript');
const fs = require('fs');

const COSMETIC_PROPS = new Set([
  'style', 'contentContainerStyle', 'className', 'color', 'colors',
  'tintColor', 'placeholderTextColor', 'backgroundColor', 'borderColor',
  'size', 'tint', 'hero', 'variant', 'tone', 'weight', 'level',
]);
const HOOKS = new Set(['useEffect', 'useCallback', 'useMemo', 'useState', 'useRef', 'useLayoutEffect']);

const file = process.argv[2];
const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const out = [];

function norm(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function inStyleSheet(node) {
  let p = node.parent;
  while (p) {
    if (ts.isCallExpression(p) && p.expression.getText().startsWith('StyleSheet.create')) return true;
    p = p.parent;
  }
  return false;
}

function walk(node) {
  if (ts.isCallExpression(node) && HOOKS.has(node.expression.getText()) && !inStyleSheet(node)) {
    out.push(node.expression.getText() + '(' + node.arguments.map((a) => norm(a.getText())).join(', ') + ')');
  }
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.body) {
    out.push('fn ' + (node.name ? node.name.getText() : '<anon>') + ' ' + norm(node.body.getText()));
  }
  if (ts.isJsxAttribute(node)) {
    const name = node.name.getText();
    if (!COSMETIC_PROPS.has(name) && node.initializer) {
      out.push('attr ' + name + '=' + norm(node.initializer.getText()));
    }
  }
  ts.forEachChild(node, walk);
}
walk(src);

const joined = out.sort().join('\n');
const crypto = require('crypto');
console.log('items=' + out.length + ' sha256=' + crypto.createHash('sha256').update(joined).digest('hex'));
if (process.argv[3]) fs.writeFileSync(process.argv[3], joined);

/**
 * Custom ESLint rule: no-hardcoded-hex
 *
 * Flags hex color literals (#xxx, #xxxxxx, #xxxxxxxx) in JSX/TSX files.
 * Enforces the "no hardcoded hex codes" zero-tolerance policy —
 * all colors must flow through @theme variables.
 */

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded hex color codes — use @theme variables instead',
    },
    messages: {
      noHex:
        'Hardcoded hex color "{{ color }}" is not allowed. Use a @theme variable (e.g. text-amber, bg-oxford-blue) instead.',
    },
    schema: [],
  },
  create(context) {
    function checkValue(node, value) {
      if (typeof value !== 'string') return;
      const matches = value.match(HEX_PATTERN);
      if (!matches) return;
      for (const color of matches) {
        context.report({ node, messageId: 'noHex', data: { color } });
      }
    }

    return {
      Literal(node) {
        checkValue(node, node.value);
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkValue(node, quasi.value.raw);
        }
      },
    };
  },
};

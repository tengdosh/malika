/**
 * Rewrites root-absolute links inside Markdown so they respect Astro's `base`.
 *
 * Astro applies `base` to its own asset URLs, and every hand-written path in a
 * component goes through withBase(). Markdown content does neither: a link
 * written as `[Hozir](/hozir)` renders as `/hozir`, which on a subpath
 * deployment points at the domain root and 404s.
 *
 * Malika writes these links in the CMS, in a rich-text editor that offers no
 * notion of a base path — so asking authors to type `/malika/hozir` would be
 * both unexplainable and wrong the moment the site moves. The build fixes them
 * instead.
 *
 * Left alone: external URLs, protocol-relative `//`, anchors, mailto:/tel:, and
 * anything already carrying the base.
 */

const ATTRIBUTES = [
  ['a', 'href'],
  ['area', 'href'],
  ['img', 'src'],
  ['source', 'src'],
  ['video', 'src'],
  ['audio', 'src'],
];

const needsBase = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');

export function rehypeBasePath(base = '/') {
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;

  return () => (tree) => {
    // No base configured: nothing to rewrite, and no tree walk worth doing.
    if (!prefix) return;

    const visit = (node) => {
      if (node.type === 'element' && node.properties) {
        for (const [tag, attribute] of ATTRIBUTES) {
          if (node.tagName !== tag) continue;
          const value = node.properties[attribute];
          if (needsBase(value) && !value.startsWith(`${prefix}/`) && value !== prefix) {
            node.properties[attribute] = `${prefix}${value}`;
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    };

    visit(tree);
  };
}

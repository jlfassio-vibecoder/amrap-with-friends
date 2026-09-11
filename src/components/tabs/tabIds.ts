/**
 * The ids that tie a tab to its panel.
 *
 * Namespaced because a page can only have one element per id and two tab sets
 * could otherwise both claim `tab-missions`. The shapes match what HUD, Coach
 * and My missions already emit, so ids are unchanged by the move to shared
 * components -- these strings are in tests and in the accessibility tree, and
 * renaming them buys nothing.
 */
export function tabIdFor(namespace: string, key: string): string {
  return `${namespace}-tab-${key}`;
}

export function panelIdFor(namespace: string, key: string): string {
  return `${namespace}-panel-${key}`;
}

import { type Item, uid } from "./model";

export function expandGroupIds(items: Item[], ids: string[]): string[] {
  const wanted = new Set(ids);
  for (const item of items) {
    if (wanted.has(item.id) && item.groupId)
      for (const member of items)
        if (member.groupId === item.groupId) wanted.add(member.id);
  }
  return items.filter((item) => wanted.has(item.id)).map((item) => item.id);
}

export function itemSelection(items: Item[], id: string): string[] {
  const item = items.find((candidate) => candidate.id === id);
  if (!item || item.hidden) return [];
  return item.groupId
    ? items
        .filter((candidate) => candidate.groupId === item.groupId && !candidate.hidden)
        .map((candidate) => candidate.id)
    : [id];
}

/** Edit operations skip a whole group if one member is locked or hidden. */
export function editableSelection(items: Item[], ids: string[]): string[] {
  const expanded = new Set(expandGroupIds(items, ids));
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    if (!expanded.has(item.id)) continue;
    if (item.groupId) groups.set(item.groupId, [...(groups.get(item.groupId) || []), item]);
  }
  const blocked = new Set<string>();
  for (const [groupId, selectedMembers] of groups) {
    const members = items.filter((item) => item.groupId === groupId);
    if (
      selectedMembers.length !== members.length ||
      members.some((item) => item.locked || item.hidden)
    )
      members.forEach((item) => blocked.add(item.id));
  }
  return items
    .filter(
      (item) =>
        expanded.has(item.id) &&
        !blocked.has(item.id) &&
        !item.locked &&
        !item.hidden,
    )
    .map((item) => item.id);
}

export function groupItems(items: Item[], ids: string[]): Item[] {
  const eligible = editableSelection(items, ids);
  if (eligible.length < 2) return items;
  const groupId = uid();
  return items.map((item) =>
    eligible.includes(item.id) ? { ...item, groupId } : item,
  );
}

export function ungroupItems(items: Item[], ids: string[]): Item[] {
  const expanded = new Set(expandGroupIds(items, ids));
  const groups = new Set(items.filter((item) => expanded.has(item.id) && item.groupId).map((item) => item.groupId!));
  const allowed = new Set<string>();
  for (const groupId of groups) {
    const members = items.filter((item) => item.groupId === groupId);
    if (members.every((item) => !item.locked && !item.hidden)) members.forEach((item) => allowed.add(item.id));
  }
  return items.map((item) => allowed.has(item.id) ? { ...item, groupId: undefined } : item);
}

export function setItemLocked(items: Item[], ids: string[], locked: boolean): Item[] {
  const expanded = new Set(expandGroupIds(items, ids));
  return items.map((item) =>
    expanded.has(item.id) ? { ...item, locked } : item,
  );
}

export function setItemHidden(items: Item[], ids: string[], hidden: boolean): Item[] {
  const expanded = new Set(expandGroupIds(items, ids));
  return items.map((item) =>
    expanded.has(item.id) ? { ...item, hidden } : item,
  );
}

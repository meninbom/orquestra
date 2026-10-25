import { type ArrowPort, type Item } from "./model";
import { portAnchor, type Point } from "./selection";

export type ConnectionPortTarget = { item: Item; port: ArrowPort; point: Point };
const ports: ArrowPort[] = ["north", "east", "south", "west"];

export function eligibleConnectionTargets(items: Item[], excluded: string[] = []): Item[] {
  const skip = new Set(excluded);
  return items.filter((item) =>
    !skip.has(item.id) && !item.hidden && !item.locked && !["arrow", "pen"].includes(item.type),
  );
}

export function connectionPortTargets(items: Item[], excluded: string[] = []): ConnectionPortTarget[] {
  return eligibleConnectionTargets(items, excluded).flatMap((item) =>
    ports.map((port) => ({ item, port, point: portAnchor(item, port) })),
  );
}

export function connectionPortAt(
  items: Item[],
  point: Point,
  excluded: string[] = [],
  tolerance = 12,
): ConnectionPortTarget | undefined {
  let nearest: ConnectionPortTarget | undefined;
  let distance = tolerance;
  const targets = connectionPortTargets(items, excluded);
  for (const target of targets) {
    const next = Math.hypot(target.point.x - point.x, target.point.y - point.y);
    if (next <= distance) {
      nearest = target;
      distance = next;
    }
  }
  return nearest;
}

export type LaserPoint = { x: number; y: number };
export type LaserSample = LaserPoint & { t: number };

export const laserLifeMs = 900;

const lifeOf = (sample: LaserSample, now: number) => Math.max(0, 1 - (now - sample.t) / laserLifeMs);

/** Tapered trail: each sample's width follows its age, so the tail thins out while the head stays solid. */
export function laserGeometry(samples: readonly LaserSample[], now: number, width: number) {
  const live = samples.filter((sample) => now - sample.t < laserLifeMs);
  const head = live[live.length - 1];
  if (!head) return { body: "", head: null as null | { x: number; y: number; r: number } };
  const headRadius = (width / 2) * Math.pow(lifeOf(head, now), 0.8);
  if (live.length < 2) return { body: "", head: { x: head.x, y: head.y, r: headRadius } };
  const left: string[] = [];
  const right: string[] = [];
  live.forEach((sample, index) => {
    const before = live[Math.max(0, index - 1)];
    const after = live[Math.min(live.length - 1, index + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = (width / 2) * Math.pow(lifeOf(sample, now), 0.8);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    left.push(`${(sample.x + nx).toFixed(2)} ${(sample.y + ny).toFixed(2)}`);
    right.push(`${(sample.x - nx).toFixed(2)} ${(sample.y - ny).toFixed(2)}`);
  });
  return { body: `M${left.join(" L")} L${right.reverse().join(" L")} Z`, head: { x: head.x, y: head.y, r: headRadius } };
}

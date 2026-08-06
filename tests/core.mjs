// Loads the DOM-free "core" region of index.html so the tests can exercise the
// real shipped code rather than a copy of it. Keeping the app a single
// self-contained file is a hard requirement (it has to run from file://), so
// the region is delimited by /* core:start */ and /* core:end */ markers
// instead of being split into a module.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.dirname(here);
export const indexPath = path.join(projectRoot, "index.html");
export const html = readFileSync(indexPath, "utf8");

const START = "/* core:start";
const END = "/* core:end */";

function extractCore(source) {
  const startMarker = source.indexOf(START);
  const endMarker = source.indexOf(END);
  if (startMarker === -1 || endMarker === -1 || endMarker < startMarker) {
    throw new Error("index.html is missing its /* core:start */ … /* core:end */ markers");
  }
  // Skip past the marker's own explanatory comment, which mentions the very
  // browser globals the region is forbidden to use.
  const afterComment = source.indexOf("*/", startMarker) + 2;
  return source.slice(afterComment, endMarker);
}

/** The extracted source of the core region, for static checks. */
export const coreSource = extractCore(html);

/** Every number in an SVG path string, in order. */
export function pathNumbers(pathData) {
  return (pathData.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** Start, control and end points of a quadratic "M … Q …" arrow path. */
export function quadraticPoints(pathData) {
  const [sx, sy, cx, cy, ex, ey] = pathNumbers(pathData);
  return {
    start: { x: sx, y: sy },
    control: { x: cx, y: cy },
    end: { x: ex, y: ey },
    middle: { x: (sx + ex) / 2, y: (sy + ey) / 2 }
  };
}

export function hypot(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Path coordinates are emitted to one decimal place, so any geometric
 *  comparison drawn from a path string carries this much slack. */
export const PATH_PRECISION = 0.1;

/** Perpendicular distance from `point` to the infinite line through a and b. */
export function perpendicularDistance(a, b, point) {
  return Math.abs((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / hypot(a, b);
}

/** Splits a list of arrows into the circuits of the permutation they encode. */
export function circuitsOf(arrows) {
  const next = new Map(arrows.map((arrow) => [arrow.id, arrow.targetId]));
  const seen = new Set();
  const circuits = [];
  for (const arrow of arrows) {
    if (seen.has(arrow.id)) continue;
    const cycle = [];
    let current = arrow.id;
    while (!seen.has(current)) {
      seen.add(current);
      cycle.push(current);
      current = next.get(current);
    }
    circuits.push(cycle);
  }
  return circuits;
}

/** True when the circuit traces a simple convex polygon — the case where
 *  "bows outward" is a meaningful thing to ask for. Q8's order-four circuits
 *  in the cube layout are self-crossing and so are excluded by this. */
export function isConvexCircuit(cycle, pointOf) {
  if (cycle.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < cycle.length; i += 1) {
    const a = pointOf(cycle[i]);
    const b = pointOf(cycle[(i + 1) % cycle.length]);
    const c = pointOf(cycle[(i + 2) % cycle.length]);
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

const exported = [
  "ANIMATION_DURATION_MS", "DOT_RADIUS", "VIEW_WIDTH", "VIEW_HEIGHT",
  "cubeSlotPositions", "CUBE_SIDE", "CUBE_DEPTH", "CUBE_TILT_DEGREES",
  "START_ARROW_CLEARANCE", "END_ARROW_CLEARANCE",
  "octagonSlotPositions", "octagonCenter",
  "quaternionSlotPositions", "quaternionCenter",
  "cayleyColors", "cayleyDashes", "mod", "buildGroups",
  "slotPositionsFor", "applyOperationWith", "elementOrderIn", "isInvolution", "animationDurationMs",
  "easeInOutCubic", "distance", "cubicPoint", "buildFourCycleSegments",
  "arrowPathBetween", "loopPathAt", "pathForArrow", "projectImages",
  "previewArrows", "cayleyArrows"
];

export const core = new Function(
  `${coreSource}\nreturn { ${exported.join(", ")} };`
)();

export const groups = core.buildGroups();
export const groupKeys = Object.keys(groups);

/** Every element id, in declaration order. */
export function idsOf(group) {
  return group.elements.map((element) => element.id);
}

/** Brute-force order of an element, independent of the app's own routine. */
export function bruteForceOrder(group, elementId) {
  let product = group.identityId;
  for (let n = 1; n <= 64; n += 1) {
    product = group.multiply(product, elementId);
    if (product === group.identityId) return n;
  }
  throw new Error(`no finite order for ${elementId}`);
}

/** Multiset of element orders, as a sorted array — a complete isomorphism
 *  invariant for groups of order 8. */
export function orderProfile(group) {
  return idsOf(group).map((id) => bruteForceOrder(group, id)).sort((a, b) => a - b);
}

export function isAbelian(group) {
  const ids = idsOf(group);
  return ids.every((a) => ids.every((b) => group.multiply(a, b) === group.multiply(b, a)));
}

export function centerOf(group) {
  const ids = idsOf(group);
  return ids.filter((a) => ids.every((b) => group.multiply(a, b) === group.multiply(b, a)));
}

/** Subgroup generated by a set of elements. */
export function generatedBy(group, generatorIds) {
  const reached = new Set([group.identityId]);
  const frontier = [group.identityId];
  while (frontier.length > 0) {
    const current = frontier.pop();
    for (const generator of generatorIds) {
      const product = group.multiply(current, generator);
      if (!reached.has(product)) {
        reached.add(product);
        frontier.push(product);
      }
    }
  }
  return reached;
}

export function inverseOf(group, elementId) {
  return idsOf(group).find((candidate) => group.multiply(elementId, candidate) === group.identityId);
}

/** The 12 edges of the 3-cube implied by the shared cube slot layout:
 *  slots 0-3 are the front square, 4-7 the back square, i ↔ i+4 the verticals. */
export const cubeEdgeIndices = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

export function cubeEdgeSet(group) {
  return new Set(cubeEdgeIndices.map(([i, j]) =>
    [group.slotOrder[i], group.slotOrder[j]].sort().join("|")));
}

/** Undirected edges of the Cayley graph of `group` on `generatorIds`. */
export function cayleyEdgeSet(group, generatorIds, side) {
  const edges = new Set();
  for (const x of idsOf(group)) {
    for (const generator of generatorIds) {
      const y = side === "left" ? group.multiply(generator, x) : group.multiply(x, generator);
      if (y !== x) edges.add([x, y].sort().join("|"));
    }
  }
  return edges;
}

export function sameSet(a, b) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

/** WCAG 2.1 relative luminance and contrast ratio, for the palette tests. */
export function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastWithWhite(hex) {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

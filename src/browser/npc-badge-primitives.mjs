import { NPC_ROLE_IDS } from './npc-markers.mjs';

export const NPC_BADGE_STYLE = 'functional-icons-v2';
export const NPC_BADGE_GRID = Object.freeze({ width: 9, height: 9 });
export const NPC_BADGE_PRIMITIVE_IDS = Object.freeze([...NPC_ROLE_IDS, 'other']);

function rectangle(x, y, width, height, tone) {
  return Object.freeze({ x, y, width, height, tone });
}

function primitive(id, rects) {
  return Object.freeze({ id, rects: Object.freeze(rects) });
}

const PRIMITIVES = new Map([
  ['bank', primitive('bank', [
    rectangle(1, 6, 7, 2, 'shadow'),
    rectangle(2, 4, 6, 2, 'primary'),
    rectangle(3, 2, 5, 2, 'accent'),
    rectangle(4, 2, 2, 1, 'primary'),
  ])],
  ['travel', primitive('travel', [
    rectangle(4, 0, 1, 9, 'shadow'),
    rectangle(0, 4, 9, 1, 'shadow'),
    rectangle(3, 1, 3, 2, 'primary'),
    rectangle(6, 4, 2, 1, 'accent'),
    rectangle(4, 6, 1, 2, 'accent'),
  ])],
  ['shop', primitive('shop', [
    rectangle(3, 1, 3, 1, 'primary'),
    rectangle(2, 2, 1, 2, 'primary'),
    rectangle(6, 2, 1, 2, 'primary'),
    rectangle(2, 4, 5, 4, 'shadow'),
    rectangle(3, 4, 3, 3, 'primary'),
    rectangle(4, 5, 1, 1, 'accent'),
  ])],
  ['quest', primitive('quest', [
    rectangle(1, 1, 2, 1, 'shadow'),
    rectangle(2, 1, 5, 7, 'shadow'),
    rectangle(3, 2, 3, 5, 'primary'),
    rectangle(4, 2, 1, 3, 'accent'),
    rectangle(4, 6, 1, 1, 'accent'),
    rectangle(6, 7, 2, 1, 'shadow'),
  ])],
  ['blessing', primitive('blessing', [
    rectangle(2, 1, 5, 1, 'accent'),
    rectangle(4, 3, 1, 5, 'primary'),
    rectangle(2, 5, 5, 1, 'primary'),
    rectangle(3, 4, 1, 1, 'accent'),
    rectangle(5, 4, 1, 1, 'accent'),
    rectangle(3, 6, 1, 1, 'accent'),
    rectangle(5, 6, 1, 1, 'accent'),
  ])],
  ['trainer', primitive('trainer', [
    rectangle(1, 2, 3, 5, 'shadow'),
    rectangle(5, 2, 3, 5, 'shadow'),
    rectangle(2, 3, 2, 3, 'primary'),
    rectangle(5, 3, 2, 3, 'primary'),
    rectangle(4, 2, 1, 6, 'accent'),
  ])],
  ['other', primitive('other', [
    rectangle(3, 1, 3, 3, 'primary'),
    rectangle(2, 4, 5, 3, 'shadow'),
    rectangle(4, 4, 1, 2, 'accent'),
    rectangle(2, 7, 2, 1, 'primary'),
    rectangle(5, 7, 2, 1, 'primary'),
  ])],
]);

export function npcBadgePrimitive(id) {
  const primitiveDefinition = PRIMITIVES.get(id);
  if (!primitiveDefinition) {
    throw new Error(`unsupported NPC badge primitive: ${String(id)}`);
  }
  return primitiveDefinition;
}

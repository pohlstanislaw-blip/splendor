// Regenerates the CARDS table in src/engine/data.ts from data/cards.csv.
// CSV columns: card_id,level,bonus_color,bonus_gem,points,cost_white,cost_blue,cost_green,cost_red,cost_black,total_cost
// Colors map to Facets gems: white→moonstone, blue→lapis, green→jade, red→garnet, black→obsidian.
import { readFileSync, writeFileSync } from 'node:fs';
import { GEMS, type Gem } from '../src/engine/types';

const COLOR: Record<string, Gem> = { white: 'moonstone', blue: 'lapis', green: 'jade', red: 'garnet', black: 'obsidian' };

const NAMES: Record<Gem, Record<1 | 2 | 3, string[]>> = {
  garnet: {
    1: ['Emberpit Dig', 'Rustvein Cut', 'Cinder Hollow', 'Redrock Trench', 'Kilnside Pit', 'Scarlet Shelf', 'Foxglove Seam', 'Blazestone Run'],
    2: ['Crucible Forge', 'Flamewright Bench', 'Rubric Kiln', 'Hearthmark Smithy', 'Copperbell Works', 'Vermilion Lathe'],
    3: ['Hall of the Ember Crown', 'Sunfire Exchange', 'Brazier Guild', 'Crimson Keep'],
  },
  lapis: {
    1: ['Tidewater Cut', 'Bluebottle Pit', 'Mistfall Seam', 'Gullwing Dig', 'Deepwell Trench', 'Saltmarsh Shelf', 'Indigo Hollow', 'Riverbend Run'],
    2: ['Cobalt Glassworks', 'Skyloom Bench', 'Wavecrest Lathe', 'Harbor Polishery', 'Azure Inkhouse', 'Stormglass Works'],
    3: ['Hall of the Tidal Seal', 'Admiralty Exchange', 'Cartographers Guild', 'Sapphire Spire'],
  },
  jade: {
    1: ['Mossback Dig', 'Fernvale Pit', 'Willowroot Seam', 'Greenshade Cut', 'Thicket Trench', 'Lichen Shelf', 'Bramble Hollow', 'Ivy Run'],
    2: ['Verdant Carvery', 'Grovewright Bench', 'Sagebrush Lathe', 'Orchard Polishery', 'Cedar Toolhouse', 'Leafvein Works'],
    3: ['Hall of the Evergreen', 'Gardeners Exchange', 'Herbalists Guild', 'Emerald Terrace'],
  },
  obsidian: {
    1: ['Ashfall Dig', 'Nightglass Pit', 'Soot Seam', 'Ravenrock Cut', 'Cinderblack Trench', 'Gloom Shelf', 'Coalback Hollow', 'Shadow Run'],
    2: ['Onyx Edgeworks', 'Duskwright Bench', 'Basalt Lathe', 'Midnight Polishery', 'Volcanic Toolhouse', 'Smokeglass Works'],
    3: ['Hall of the Black Mirror', 'Ironvault Exchange', 'Lampless Guild', 'Eclipse Citadel'],
  },
  moonstone: {
    1: ['Pearlmist Dig', 'Frostline Pit', 'Paleglow Seam', 'Snowcap Cut', 'Chalkwhite Trench', 'Silverbirch Shelf', 'Dewdrop Hollow', 'Starfall Run'],
    2: ['Opaline Studio', 'Lunawright Bench', 'Ivory Lathe', 'Glimmer Polishery', 'Quartzlight Works', 'Halo Toolhouse'],
    3: ['Hall of the Silver Moon', 'Pale Court Exchange', 'Astronomers Guild', 'Moonrise Tower'],
  },
};

const [header, ...lines] = readFileSync('data/cards.csv', 'utf8').trim().split(/\r?\n/);
const cols = header.split(',');
const counter: Record<string, number> = {};
const out: string[] = [];
for (const line of lines) {
  const r = Object.fromEntries(line.split(',').map((v, i) => [cols[i], v.trim()]));
  const tier = Number(r.level) as 1 | 2 | 3;
  const bonus = COLOR[r.bonus_color];
  if (!bonus || ![1, 2, 3].includes(tier)) throw new Error(`Bad row: ${line}`);
  const key = `${tier}-${bonus}`;
  const n = (counter[key] = (counter[key] ?? 0) + 1);
  const name = NAMES[bonus][tier][n - 1];
  if (!name) throw new Error(`Too many tier ${tier} ${bonus} cards`);
  const cost: Partial<Record<Gem, number>> = {};
  for (const [c, g] of Object.entries(COLOR)) if (Number(r[`cost_${c}`])) cost[g] = Number(r[`cost_${c}`]);
  const total = Object.values(cost).reduce((a, b) => a + (b ?? 0), 0);
  if (total !== Number(r.total_cost)) throw new Error(`Card ${r.card_id}: total_cost ${r.total_cost} ≠ ${total}`);
  const costStr = GEMS.filter((g) => cost[g]).map((g) => `${g}: ${cost[g]}`).join(', ');
  out.push(
    `  { id: 't${tier}-${bonus.slice(0, 3)}-${n}', tier: ${tier}, name: '${name}', bonus: '${bonus}', points: ${Number(r.points)}, cost: { ${costStr} } }, // csv #${r.card_id}`,
  );
}

const path = 'src/engine/data.ts';
const src = readFileSync(path, 'utf8');
const start = src.indexOf('export const CARDS: Card[] = [');
const end = src.indexOf('];', start);
writeFileSync(path, src.slice(0, start) + 'export const CARDS: Card[] = [\n' + out.join('\n') + '\n' + src.slice(end));
console.log(`Wrote ${out.length} cards to ${path}`);

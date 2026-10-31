// Card data for Facets. CARDS is generated from data/cards.csv by `npm run import-cards` (do not edit by hand).
// Patrons are hand-authored below. Run `npm run balance` to print a balance summary.
import type { Card, Patron } from './types';

export const CARDS: Card[] = [
  { id: 't1-obs-1', tier: 1, name: 'Ashfall Dig', bonus: 'obsidian', points: 0, cost: { garnet: 1, lapis: 1, jade: 1, moonstone: 1 } }, // csv #1
  { id: 't1-obs-2', tier: 1, name: 'Nightglass Pit', bonus: 'obsidian', points: 0, cost: { garnet: 1, lapis: 2, jade: 1, moonstone: 1 } }, // csv #2
  { id: 't1-obs-3', tier: 1, name: 'Soot Seam', bonus: 'obsidian', points: 0, cost: { garnet: 1, lapis: 2, moonstone: 2 } }, // csv #3
  { id: 't1-obs-4', tier: 1, name: 'Ravenrock Cut', bonus: 'obsidian', points: 0, cost: { garnet: 3, jade: 1, obsidian: 1 } }, // csv #4
  { id: 't1-obs-5', tier: 1, name: 'Cinderblack Trench', bonus: 'obsidian', points: 0, cost: { garnet: 1, jade: 2 } }, // csv #5
  { id: 't1-obs-6', tier: 1, name: 'Gloom Shelf', bonus: 'obsidian', points: 0, cost: { jade: 2, moonstone: 2 } }, // csv #6
  { id: 't1-obs-7', tier: 1, name: 'Coalback Hollow', bonus: 'obsidian', points: 0, cost: { jade: 3 } }, // csv #7
  { id: 't1-obs-8', tier: 1, name: 'Shadow Run', bonus: 'obsidian', points: 1, cost: { lapis: 4 } }, // csv #8
  { id: 't1-lap-1', tier: 1, name: 'Tidewater Cut', bonus: 'lapis', points: 0, cost: { garnet: 1, jade: 1, obsidian: 1, moonstone: 1 } }, // csv #9
  { id: 't1-lap-2', tier: 1, name: 'Bluebottle Pit', bonus: 'lapis', points: 0, cost: { garnet: 2, jade: 1, obsidian: 1, moonstone: 1 } }, // csv #10
  { id: 't1-lap-3', tier: 1, name: 'Mistfall Seam', bonus: 'lapis', points: 0, cost: { garnet: 2, jade: 2, moonstone: 1 } }, // csv #11
  { id: 't1-lap-4', tier: 1, name: 'Gullwing Dig', bonus: 'lapis', points: 0, cost: { garnet: 1, lapis: 1, jade: 3 } }, // csv #12
  { id: 't1-lap-5', tier: 1, name: 'Deepwell Trench', bonus: 'lapis', points: 0, cost: { obsidian: 2, moonstone: 1 } }, // csv #13
  { id: 't1-lap-6', tier: 1, name: 'Saltmarsh Shelf', bonus: 'lapis', points: 0, cost: { jade: 2, obsidian: 2 } }, // csv #14
  { id: 't1-lap-7', tier: 1, name: 'Indigo Hollow', bonus: 'lapis', points: 0, cost: { obsidian: 3 } }, // csv #15
  { id: 't1-lap-8', tier: 1, name: 'Riverbend Run', bonus: 'lapis', points: 1, cost: { garnet: 4 } }, // csv #16
  { id: 't1-moo-1', tier: 1, name: 'Pearlmist Dig', bonus: 'moonstone', points: 0, cost: { garnet: 1, lapis: 1, jade: 1, obsidian: 1 } }, // csv #17
  { id: 't1-moo-2', tier: 1, name: 'Frostline Pit', bonus: 'moonstone', points: 0, cost: { garnet: 1, lapis: 1, jade: 2, obsidian: 1 } }, // csv #18
  { id: 't1-moo-3', tier: 1, name: 'Paleglow Seam', bonus: 'moonstone', points: 0, cost: { lapis: 2, jade: 2, obsidian: 1 } }, // csv #19
  { id: 't1-moo-4', tier: 1, name: 'Snowcap Cut', bonus: 'moonstone', points: 0, cost: { lapis: 1, obsidian: 1, moonstone: 3 } }, // csv #20
  { id: 't1-moo-5', tier: 1, name: 'Chalkwhite Trench', bonus: 'moonstone', points: 0, cost: { garnet: 2, obsidian: 1 } }, // csv #21
  { id: 't1-moo-6', tier: 1, name: 'Silverbirch Shelf', bonus: 'moonstone', points: 0, cost: { lapis: 2, obsidian: 2 } }, // csv #22
  { id: 't1-moo-7', tier: 1, name: 'Dewdrop Hollow', bonus: 'moonstone', points: 0, cost: { lapis: 3 } }, // csv #23
  { id: 't1-moo-8', tier: 1, name: 'Starfall Run', bonus: 'moonstone', points: 1, cost: { jade: 4 } }, // csv #24
  { id: 't1-jad-1', tier: 1, name: 'Mossback Dig', bonus: 'jade', points: 0, cost: { garnet: 1, lapis: 1, obsidian: 1, moonstone: 1 } }, // csv #25
  { id: 't1-jad-2', tier: 1, name: 'Fernvale Pit', bonus: 'jade', points: 0, cost: { garnet: 1, lapis: 1, obsidian: 2, moonstone: 1 } }, // csv #26
  { id: 't1-jad-3', tier: 1, name: 'Willowroot Seam', bonus: 'jade', points: 0, cost: { garnet: 2, lapis: 1, obsidian: 2 } }, // csv #27
  { id: 't1-jad-4', tier: 1, name: 'Greenshade Cut', bonus: 'jade', points: 0, cost: { lapis: 3, jade: 1, moonstone: 1 } }, // csv #28
  { id: 't1-jad-5', tier: 1, name: 'Thicket Trench', bonus: 'jade', points: 0, cost: { lapis: 1, moonstone: 2 } }, // csv #29
  { id: 't1-jad-6', tier: 1, name: 'Lichen Shelf', bonus: 'jade', points: 0, cost: { garnet: 2, lapis: 2 } }, // csv #30
  { id: 't1-jad-7', tier: 1, name: 'Bramble Hollow', bonus: 'jade', points: 0, cost: { garnet: 3 } }, // csv #31
  { id: 't1-jad-8', tier: 1, name: 'Ivy Run', bonus: 'jade', points: 1, cost: { obsidian: 4 } }, // csv #32
  { id: 't1-gar-1', tier: 1, name: 'Emberpit Dig', bonus: 'garnet', points: 0, cost: { lapis: 1, jade: 1, obsidian: 1, moonstone: 1 } }, // csv #33
  { id: 't1-gar-2', tier: 1, name: 'Rustvein Cut', bonus: 'garnet', points: 0, cost: { lapis: 1, jade: 1, obsidian: 1, moonstone: 2 } }, // csv #34
  { id: 't1-gar-3', tier: 1, name: 'Cinder Hollow', bonus: 'garnet', points: 0, cost: { jade: 1, obsidian: 2, moonstone: 2 } }, // csv #35
  { id: 't1-gar-4', tier: 1, name: 'Redrock Trench', bonus: 'garnet', points: 0, cost: { garnet: 1, obsidian: 3, moonstone: 1 } }, // csv #36
  { id: 't1-gar-5', tier: 1, name: 'Kilnside Pit', bonus: 'garnet', points: 0, cost: { lapis: 2, jade: 1 } }, // csv #37
  { id: 't1-gar-6', tier: 1, name: 'Scarlet Shelf', bonus: 'garnet', points: 0, cost: { garnet: 2, moonstone: 2 } }, // csv #38
  { id: 't1-gar-7', tier: 1, name: 'Foxglove Seam', bonus: 'garnet', points: 0, cost: { moonstone: 3 } }, // csv #39
  { id: 't1-gar-8', tier: 1, name: 'Blazestone Run', bonus: 'garnet', points: 1, cost: { moonstone: 4 } }, // csv #40
  { id: 't2-obs-1', tier: 2, name: 'Onyx Edgeworks', bonus: 'obsidian', points: 1, cost: { lapis: 2, jade: 2, moonstone: 3 } }, // csv #41
  { id: 't2-obs-2', tier: 2, name: 'Duskwright Bench', bonus: 'obsidian', points: 1, cost: { jade: 3, obsidian: 2, moonstone: 3 } }, // csv #42
  { id: 't2-obs-3', tier: 2, name: 'Basalt Lathe', bonus: 'obsidian', points: 2, cost: { garnet: 2, lapis: 1, jade: 4 } }, // csv #43
  { id: 't2-obs-4', tier: 2, name: 'Midnight Polishery', bonus: 'obsidian', points: 2, cost: { garnet: 3, jade: 5 } }, // csv #44
  { id: 't2-obs-5', tier: 2, name: 'Volcanic Toolhouse', bonus: 'obsidian', points: 2, cost: { moonstone: 5 } }, // csv #45
  { id: 't2-obs-6', tier: 2, name: 'Smokeglass Works', bonus: 'obsidian', points: 3, cost: { obsidian: 6 } }, // csv #46
  { id: 't2-lap-1', tier: 2, name: 'Cobalt Glassworks', bonus: 'lapis', points: 1, cost: { garnet: 3, lapis: 2, jade: 2 } }, // csv #47
  { id: 't2-lap-2', tier: 2, name: 'Skyloom Bench', bonus: 'lapis', points: 1, cost: { lapis: 2, jade: 3, obsidian: 3 } }, // csv #48
  { id: 't2-lap-3', tier: 2, name: 'Wavecrest Lathe', bonus: 'lapis', points: 2, cost: { lapis: 3, moonstone: 5 } }, // csv #49
  { id: 't2-lap-4', tier: 2, name: 'Harbor Polishery', bonus: 'lapis', points: 2, cost: { garnet: 1, obsidian: 4, moonstone: 2 } }, // csv #50
  { id: 't2-lap-5', tier: 2, name: 'Azure Inkhouse', bonus: 'lapis', points: 2, cost: { lapis: 5 } }, // csv #51
  { id: 't2-lap-6', tier: 2, name: 'Stormglass Works', bonus: 'lapis', points: 3, cost: { lapis: 6 } }, // csv #52
  { id: 't2-moo-1', tier: 2, name: 'Opaline Studio', bonus: 'moonstone', points: 1, cost: { garnet: 2, jade: 3, obsidian: 2 } }, // csv #53
  { id: 't2-moo-2', tier: 2, name: 'Lunawright Bench', bonus: 'moonstone', points: 1, cost: { garnet: 3, lapis: 3, moonstone: 2 } }, // csv #54
  { id: 't2-moo-3', tier: 2, name: 'Ivory Lathe', bonus: 'moonstone', points: 2, cost: { garnet: 4, jade: 1, obsidian: 2 } }, // csv #55
  { id: 't2-moo-4', tier: 2, name: 'Glimmer Polishery', bonus: 'moonstone', points: 2, cost: { garnet: 5, obsidian: 3 } }, // csv #56
  { id: 't2-moo-5', tier: 2, name: 'Quartzlight Works', bonus: 'moonstone', points: 2, cost: { garnet: 5 } }, // csv #57
  { id: 't2-moo-6', tier: 2, name: 'Halo Toolhouse', bonus: 'moonstone', points: 3, cost: { moonstone: 6 } }, // csv #58
  { id: 't2-jad-1', tier: 2, name: 'Verdant Carvery', bonus: 'jade', points: 1, cost: { garnet: 3, jade: 2, moonstone: 3 } }, // csv #59
  { id: 't2-jad-2', tier: 2, name: 'Grovewright Bench', bonus: 'jade', points: 1, cost: { lapis: 3, obsidian: 2, moonstone: 2 } }, // csv #60
  { id: 't2-jad-3', tier: 2, name: 'Sagebrush Lathe', bonus: 'jade', points: 2, cost: { lapis: 2, obsidian: 1, moonstone: 4 } }, // csv #61
  { id: 't2-jad-4', tier: 2, name: 'Orchard Polishery', bonus: 'jade', points: 2, cost: { lapis: 5, jade: 3 } }, // csv #62
  { id: 't2-jad-5', tier: 2, name: 'Cedar Toolhouse', bonus: 'jade', points: 2, cost: { jade: 5 } }, // csv #63
  { id: 't2-jad-6', tier: 2, name: 'Leafvein Works', bonus: 'jade', points: 3, cost: { jade: 6 } }, // csv #64
  { id: 't2-gar-1', tier: 2, name: 'Crucible Forge', bonus: 'garnet', points: 1, cost: { garnet: 2, obsidian: 3, moonstone: 2 } }, // csv #65
  { id: 't2-gar-2', tier: 2, name: 'Flamewright Bench', bonus: 'garnet', points: 1, cost: { garnet: 2, lapis: 3, obsidian: 3 } }, // csv #66
  { id: 't2-gar-3', tier: 2, name: 'Rubric Kiln', bonus: 'garnet', points: 2, cost: { lapis: 4, jade: 2, moonstone: 1 } }, // csv #67
  { id: 't2-gar-4', tier: 2, name: 'Hearthmark Smithy', bonus: 'garnet', points: 2, cost: { obsidian: 5, moonstone: 3 } }, // csv #68
  { id: 't2-gar-5', tier: 2, name: 'Copperbell Works', bonus: 'garnet', points: 2, cost: { obsidian: 5 } }, // csv #69
  { id: 't2-gar-6', tier: 2, name: 'Vermilion Lathe', bonus: 'garnet', points: 3, cost: { garnet: 6 } }, // csv #70
  { id: 't3-obs-1', tier: 3, name: 'Hall of the Black Mirror', bonus: 'obsidian', points: 3, cost: { garnet: 3, lapis: 3, jade: 5, moonstone: 3 } }, // csv #71
  { id: 't3-obs-2', tier: 3, name: 'Ironvault Exchange', bonus: 'obsidian', points: 4, cost: { garnet: 7 } }, // csv #72
  { id: 't3-obs-3', tier: 3, name: 'Lampless Guild', bonus: 'obsidian', points: 4, cost: { garnet: 6, jade: 3, obsidian: 3 } }, // csv #73
  { id: 't3-obs-4', tier: 3, name: 'Eclipse Citadel', bonus: 'obsidian', points: 5, cost: { garnet: 7, obsidian: 3 } }, // csv #74
  { id: 't3-lap-1', tier: 3, name: 'Hall of the Tidal Seal', bonus: 'lapis', points: 3, cost: { garnet: 3, jade: 3, obsidian: 5, moonstone: 3 } }, // csv #75
  { id: 't3-lap-2', tier: 3, name: 'Admiralty Exchange', bonus: 'lapis', points: 4, cost: { moonstone: 7 } }, // csv #76
  { id: 't3-lap-3', tier: 3, name: 'Cartographers Guild', bonus: 'lapis', points: 4, cost: { lapis: 3, obsidian: 3, moonstone: 6 } }, // csv #77
  { id: 't3-lap-4', tier: 3, name: 'Sapphire Spire', bonus: 'lapis', points: 5, cost: { lapis: 3, moonstone: 7 } }, // csv #78
  { id: 't3-moo-1', tier: 3, name: 'Hall of the Silver Moon', bonus: 'moonstone', points: 3, cost: { garnet: 5, lapis: 3, jade: 3, obsidian: 3 } }, // csv #79
  { id: 't3-moo-2', tier: 3, name: 'Pale Court Exchange', bonus: 'moonstone', points: 4, cost: { obsidian: 7 } }, // csv #80
  { id: 't3-moo-3', tier: 3, name: 'Astronomers Guild', bonus: 'moonstone', points: 4, cost: { garnet: 3, obsidian: 6, moonstone: 3 } }, // csv #81
  { id: 't3-moo-4', tier: 3, name: 'Moonrise Tower', bonus: 'moonstone', points: 5, cost: { obsidian: 7, moonstone: 3 } }, // csv #82
  { id: 't3-jad-1', tier: 3, name: 'Hall of the Evergreen', bonus: 'jade', points: 3, cost: { garnet: 3, lapis: 3, obsidian: 3, moonstone: 5 } }, // csv #83
  { id: 't3-jad-2', tier: 3, name: 'Gardeners Exchange', bonus: 'jade', points: 4, cost: { lapis: 7 } }, // csv #84
  { id: 't3-jad-3', tier: 3, name: 'Herbalists Guild', bonus: 'jade', points: 4, cost: { lapis: 6, jade: 3, moonstone: 3 } }, // csv #85
  { id: 't3-jad-4', tier: 3, name: 'Emerald Terrace', bonus: 'jade', points: 5, cost: { lapis: 7, jade: 3 } }, // csv #86
  { id: 't3-gar-1', tier: 3, name: 'Hall of the Ember Crown', bonus: 'garnet', points: 3, cost: { lapis: 5, jade: 3, obsidian: 3, moonstone: 3 } }, // csv #87
  { id: 't3-gar-2', tier: 3, name: 'Sunfire Exchange', bonus: 'garnet', points: 4, cost: { jade: 7 } }, // csv #88
  { id: 't3-gar-3', tier: 3, name: 'Brazier Guild', bonus: 'garnet', points: 4, cost: { garnet: 3, lapis: 3, jade: 6 } }, // csv #89
  { id: 't3-gar-4', tier: 3, name: 'Crimson Keep', bonus: 'garnet', points: 5, cost: { garnet: 3, jade: 7 } }, // csv #90
];

export const PATRONS: Patron[] = [
  { id: 'patron-1', name: 'Lady Orvelle Thane', points: 3, requires: { garnet: 4, lapis: 4 } },
  { id: 'patron-2', name: 'Master Quill Harrow', points: 3, requires: { lapis: 4, jade: 4 } },
  { id: 'patron-3', name: 'Duchess Wren Alcott', points: 3, requires: { jade: 4, obsidian: 4 } },
  { id: 'patron-4', name: 'Sir Bastian Morrow', points: 3, requires: { obsidian: 4, moonstone: 4 } },
  { id: 'patron-5', name: 'Archivist Ines Vale', points: 3, requires: { garnet: 4, moonstone: 4 } },
  { id: 'patron-6', name: 'Magister Corvin Lisle', points: 3, requires: { garnet: 3, lapis: 3, jade: 3 } },
  { id: 'patron-7', name: 'Dame Petra Holloway', points: 3, requires: { lapis: 3, jade: 3, obsidian: 3 } },
  { id: 'patron-8', name: 'Envoy Taddeo Brix', points: 3, requires: { jade: 3, obsidian: 3, moonstone: 3 } },
  { id: 'patron-9', name: 'Countess Mirela Fenn', points: 3, requires: { garnet: 3, obsidian: 3, moonstone: 3 } },
  { id: 'patron-10', name: 'Provost Aldric Venn', points: 3, requires: { garnet: 3, lapis: 3, moonstone: 3 } },
];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const PATRON_BY_ID: Record<string, Patron> = Object.fromEntries(PATRONS.map((p) => [p.id, p]));

export const TIER_NAMES = { 1: 'Quarries', 2: 'Workshops', 3: 'Guildhalls' } as const;

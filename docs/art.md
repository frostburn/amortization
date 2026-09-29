# Art provenance

## Visual direction

An aging municipal city absorbed by corporate ownership. The early operations
establish a serious, grounded baseline: ordinary infrastructure, restrained
signage, and evidence of use. Humorous props and slogans should wait until that
baseline is established. Painterly portraits and faceted map models remain the
shared character language.

The environment uses chalky concrete, dirty cream coping, faded brick, blue-grey
glass, slate roofs, timber crates and oxblood transit paint against cool asphalt.
Warm windows suggest occupied buildings. Mortar joints, damp bases, roof seams,
service vents and downpipes provide quiet material detail. Wear is sparse and
flat; architectural details follow the existing world projection and footprints.
Contact shadows anchor solid scenery without adding obstacles.

Every living, free operative carries a soft seven-unit light pool, including
unselected teammates. A recruited witness carries one too, even while waiting.
Pools follow interpolated movement and merge by their brightest contribution,
so a clustered team does not wash out the scene. Outside them, a cool ambient
shade retains at least 60% of the underlying color. The complete map, enemies and
sight cones remain visible; this lighting does not affect guard perception,
line of sight, disguises or replay state. Objective markers, orders and selection
indicators sit above the shade.

During extraction, pools follow passengers to the van, then accompany its
departure. Fallen or captive characters do not emit light. Defeat retains the
same readable ambient floor. The renderer uses one viewport-sized GPU pass with
five fixed light slots, without per-frame texture generation or offscreen
filters. Camera pan, zoom, viewport resizing and display density all use the same
projection as the models. `tests/browser/lighting.spec.ts` verifies actual
rendered pixels for overlap, split crew, captivity, death, witness recruitment,
movement interpolation and camera transforms.

## Portrait assets

The production portrait atlases were generated for Amortization using OpenAI's built-in image-generation tool: the squad on 2026-09-25, and witnesses on 2026-09-27. Both depict original fictional characters. PNG outputs were converted to WebP. CSS background positions select the appropriate portrait. The witness atlas is 768×384 pixels and 44 KB.

| Asset                          | Layout                                              | Usage                        |
| ------------------------------ | --------------------------------------------------- | ---------------------------- |
| `public/assets/portraits.webp` | 2×2: Morrow, Vale, Rook, Sable                      | Squad and selected operative |
| `public/assets/witnesses.webp` | 2×1: Iona Voss, Mara Quill                          | Witness wait/follow controls |

## Portrait prompt

Production game asset sheet for AMORTIZATION, dark corporate espionage tactical game. Exact regular 2 by 2 grid filling a square image, four square head-and-shoulders portraits, no gutters, each centered. Top-left Morrow: stern young adult woman, dark short hair, charcoal high collar tactical coat. Top-right Vale: middle-aged man, dark hair and beard, clear glasses, black utility jacket. Bottom-left Rook: muscular black man, shaved head, charcoal coat. Bottom-right Sable: adult woman with silver short hair, dark tactical coat. Original characters, realistic hand-painted videogame portrait artwork, subtle painterly strokes, muted greys and slate greens, warm reflected light, sharp eyes, dark charcoal backgrounds, uniform scale, distinct faces. No weapons, text, logo, or frames. Faces within the central 70% of each quadrant. Shoulder bust portraits facing slightly camera right. Finished production art, serious economical mood.

## Witness portrait prompt

Use case: stylized-concept. Asset type: two NPC portraits in a single production game UI atlas for AMORTIZATION, a dark corporate espionage tactical game. Exact 2-column by 1-row grid, total image aspect 2:1. Each half is one square portrait, no gutters, border, separator, words or logo. Left square: Iona Voss, a middle-aged female engineer, practical silver-grey chin-length bob with a side part, intelligent tired eyes, a beige laboratory coat over a dark grey high-collar work shirt, subtle industrial workwear details. Right square: Mara Quill, an adult female auditor in her forties, warm medium-brown skin, dark brown hair tucked in a neat low bun, thin bronze rectangular glasses, muted teal blouse and charcoal cardigan. Both are original fictional characters. Head-and-shoulders busts, facing slightly camera right, same face scale, eyes within central seventy percent, generous headroom so hair is not cropped. Realistic hand-painted videogame portraits with defined brushwork, quiet serious expressions, economical restrained noir mood, sharp eyes, muted greys and slate greens, warm reflected side light from upper left, dark charcoal backgrounds. Not glamour, no weapons, no futuristic headgear, no text. Finished production artwork legible at 44px thumbnail size.

## Retired sprite atlas

The original `people.webp` atlas is preserved in git history. Its shared operative
and mirrored direction were replaced by the code-drawn models below. Original prompt:

Production sprite atlas for an isometric tactical videogame, transparent background. Square image, regular 2×2 grid, each sprite centered in its quadrant with generous padding. Four whole-body humans viewed from elevated isometric angle, facing diagonally down-left. Top left: covert operative in long charcoal tactical coat, small pistol down at side, teal collar accent. Top right: maintenance worker in olive-grey coveralls, yellow hardhat, small tool bag. Bottom left: guard in muted brown uniform, orange shoulder band, compact rifle. Bottom right: female engineer with silver bob, beige laboratory coat, dark trousers. Crisp stylized low-poly painted artwork, lighting upper left. No cast ground shadow, rings, background, floor, or text. Full bodies, same scale and feet alignment, legible at small game scale.

## In-world models

`src/render/person.ts` draws small faceted models in the same projection as the
architecture. Each of the four operatives has its own proportions, skin, clothing,
hair, and facial details, including Vale's glasses and beard, Rook's shaved head,
Morrow's dark swept hair, and Sable's silver bob. Voss and Mara match their witness
portraits. The maintenance outfit preserves the person beneath the uniform.

Models have 32 facings, articulated knees with fixed thigh and shin lengths,
two-handed aim and recoil, carried cargo,
and a separate grounded fallen pose. A bounded shared cache reuses tessellated
poses across strides and guards, keeps visible frames alive, and releases its
geometry on mission reset. Foot contacts and shadows share the gait's ground projection.
GPU depth testing resolves overlapping body surfaces rather than sorting whole
faces by their average depth. Separate depth intervals preserve the map's painter
order between characters and architecture.
Guard shoulder caps are attached to the shoulder joint with restrained arm
rotation. Each leg pushes its own side of the coat outward, with a soft fold
between the leading and trailing sides. The chest and belt retain their shape;
this deformation also applies to operative and witness coats. Clothing is posed
geometry, without a separate cloth simulation.
The character art is illustrative. Markers and status text communicate exact
selection, weapon state, suspicion, and custody. Architecture and interface icons
are original code drawings. Audio is synthesized; no third-party audio samples or
runtime external fonts are used.

Text textures are refreshed for camera scale and pixel density. Lamp illumination
is projected onto its wall face and inherits that wall's occlusion.

Extraction vans face the map edge they will drive toward from the moment they
are parked. The renderer and departure animation share that heading. North- and
west-facing views expose double rear doors, red lamps and a rear bumper; their
cab, roof and near body panels use a matching drawing order. The stationary
custody transport keeps its original orientation.

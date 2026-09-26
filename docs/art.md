# Art provenance

The two production atlases were generated for Amortization using OpenAI's built-in image-generation tool on 2026-09-25. Both depict original fictional characters. PNG outputs were converted to WebP. Runtime texture frames and CSS background positions select their quadrants.

| Asset                          | Layout                                              | Usage                        |
| ------------------------------ | --------------------------------------------------- | ---------------------------- |
| `public/assets/portraits.webp` | 2×2: Morrow, Vale, Rook, Sable                      | Squad and selected operative |
| `public/assets/people.webp`    | 2×2: operative, maintenance worker, guard, engineer | In-world characters          |

## Portrait prompt

Production game asset sheet for AMORTIZATION, dark corporate espionage tactical game. Exact regular 2 by 2 grid filling a square image, four square head-and-shoulders portraits, no gutters, each centered. Top-left Morrow: stern young adult woman, dark short hair, charcoal high collar tactical coat. Top-right Vale: middle-aged man, dark hair and beard, clear glasses, black utility jacket. Bottom-left Rook: muscular black man, shaved head, charcoal coat. Bottom-right Sable: adult woman with silver short hair, dark tactical coat. Original characters, realistic hand-painted videogame portrait artwork, subtle painterly strokes, muted greys and slate greens, warm reflected light, sharp eyes, dark charcoal backgrounds, uniform scale, distinct faces. No weapons, text, logo, or frames. Faces within the central 70% of each quadrant. Shoulder bust portraits facing slightly camera right. Finished production art, serious economical mood.

## Sprite prompt

Production sprite atlas for an isometric tactical videogame, transparent background. Square image, regular 2×2 grid, each sprite centered in its quadrant with generous padding. Four whole-body humans viewed from elevated isometric angle, facing diagonally down-left. Top left: covert operative in long charcoal tactical coat, small pistol down at side, teal collar accent. Top right: maintenance worker in olive-grey coveralls, yellow hardhat, small tool bag. Bottom left: guard in muted brown uniform, orange shoulder band, compact rifle. Bottom right: female engineer with silver bob, beige laboratory coat, dark trousers. Crisp stylized low-poly painted artwork, lighting upper left. No cast ground shadow, rings, background, floor, or text. Full bodies, same scale and feet alignment, legible at small game scale.

The character art is illustrative. Code-native markers and status text communicate precise selection, weapon state, suspicion, and custody. Architecture and interface icons are original code drawings. Audio is synthesized; no third-party audio samples or runtime external fonts are used.

`src/render/person.ts` records the two sole contact points for each quadrant, measured from the atlas. Update those anchors when replacing the character art so the bodies and animated contact shadows stay aligned with the ground. The walking mesh and vehicle geometry are drawn in code; this polish adds no generated assets.

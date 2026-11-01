# 저만치

- Publish this repository to https://seonyoungyoo16.github.io/jeomanchi/ through the existing main-branch GitHub Actions workflow.
- Final logo selected on 2026-11-01: orbit-simple-v3.png, the simplified third concept (같은 궤도). It shows two whole birds far apart on an open circular path, without lettering, leaves or rough strokes. The gray counterpart's legs and feet use the same gray as its body. Preserve the approved image for exported PNG/ICO and favicon assets.
- Use this mark for the favicon/ICO and downloadable logo assets only. The user explicitly rejected inserting a logo into the game header or result card. Preserve their original typography and layout.
- Brand meaning: wanting to meet someone similar to oneself who is far away ("저만치 멀리 떨어진 나와 비슷한 너를 만나고 싶어"). Retain the distance and empty space between the two beings. The user rejected the cropped-head logo as emotionally empty and confirmed the full-bird orbit mark after simplification and leg-color correction.
- Preserve the original character, physics, sound, route and seasonal weather behavior for branding changes.
- In logo artwork, the shadow's head, body, legs and feet must all use the same gray. Do not give the gray counterpart the white bird's black legs.
- Runtime assets and icon links must respect Vite's Pages base path. Update the icon cache version when replacing it.
- The workflow validates the existing Sites build, runs npm test and builds dist/client for Pages. Keep that workflow and the original Sites build support intact.

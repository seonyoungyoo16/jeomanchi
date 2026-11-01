# 저만치 심볼

2026-11-01 사용자가 고른 B안(가까운 겹침)에서 모든 글자를 제거했다. 앞쪽 흰 황새와 오른쪽 위 회색 그림자는 실제 게임 캐릭터의 SVG 경로와 원본 걷기 포즈를 그대로 조합했다. 새로 생성한 다른 황새는 사용하지 않는다.

- 앞 캐릭터: `original-walk-rig.json`의 6번 포즈, `translate(215 340) scale(1.5)`.
- 뒤 그림자: 같은 리그의 1번 포즈, `translate(248 325) scale(1.5)`, 단색 `#8b8e90`.
- 머리: `original-head-crest.svg`의 두 가닥 검은 머리깃 포함.
- 몸과 다리: `original-body.svg`, `original-leg.svg`.
- 로고 SVG/투명 PNG: `public/assets/brand/jeomanchi-symbol.svg`, `jeomanchi-symbol.png`.
- 탭 아이콘: `public/assets/brand/favicon.svg`, `favicon-16.png`, `favicon-32.png`.
- ICO: `public/favicon.ico`에 16/32/48/256px PNG 프레임 포함.
- 홈 화면 아이콘: `public/assets/brand/apple-touch-icon.png` (180px, 게임 배경색).

시안 B의 원본 심볼 구도는 유지하고 글자 부분만 제거했다. SVG 로고는 `viewBox="145 48 250 305"`, 정사각형 아이콘은 `viewBox="120 48 305 305"`로 맞췄다. 로고 안에 글자나 폰트는 없다. 브라우저 제목·접근성 이름은 여전히 저만치다.

제작은 기존 벡터 에셋의 조합과 Sharp의 PNG/ICO 형식 변환으로 수행했다. 최종 로고에는 이미지 생성 프롬프트나 신규 캐릭터 드로잉을 사용하지 않았다. 사용자 요청에 따라 게임 상단과 결과 카드는 기존 상태를 유지한다. 새 심볼은 파비콘/ICO와 별도 로고 파일에만 사용한다.

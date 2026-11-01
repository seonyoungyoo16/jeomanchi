# 저만치 심볼

2026-11-01 사용자가 승인한 머리·목 겹침안이다. 흰 황새 앞에 회색 그림자가 오른쪽 위로 겹치며, 글씨는 포함하지 않는다. 실제 게임 캐릭터의 머리·부리·두 가닥 머리깃을 그대로 사용했다.

- 머리: `public/assets/original-head-crest.svg`의 원본 경로.
- 목: `original-body.svg`를 게임의 머리 연결점 `translate(-29.4 87.75)`에 맞춘 뒤 몸통이 시작되기 전에 잘랐다.
- 목 끝: 머리 기준 y=42의 직선. 보이는 목 길이는 약 46에서 31로 줄어 이전 시안보다 약 ⅓ 짧다.
- 그림자: `translate(22 -10)`, 단색 `#8b8e90`.
- 로고 SVG/투명 PNG: `public/assets/brand/jeomanchi-symbol.svg`, `jeomanchi-symbol.png`.
- 탭 아이콘: `public/assets/brand/favicon.svg`, `favicon-16.png`, `favicon-32.png`.
- ICO: `public/favicon.ico`에 16/32/48/256px PNG 프레임 포함.
- 홈 화면 아이콘: `public/assets/brand/apple-touch-icon.png` (180px, 게임 배경색).

로고는 `viewBox="-44 -39 138 95"`, 정사각형 아이콘은 `viewBox="-44 -62 138 138"`로 맞췄다. 로고 안에 글자나 폰트는 없다. 브라우저 제목·접근성 이름은 여전히 저만치다.

제작은 기존 벡터 에셋의 조합과 Sharp의 PNG/ICO 형식 변환으로 수행했다. 최종 로고에는 이미지 생성 프롬프트나 신규 캐릭터 드로잉을 사용하지 않았다. 사용자 요청에 따라 게임 상단과 결과 카드는 기존 상태를 유지한다. 새 심볼은 파비콘/ICO와 별도 로고 파일에만 사용한다.

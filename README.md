# 저만치

[게임 플레이](https://seonyoungyoo16.github.io/jeomanchi/)

좌우 방향키 또는 화면 버튼으로 균형을 잡으며 앞서가는 그림자를 따라 걷는 브라우저 게임입니다. 덕수궁 돌담길에서 시작해 20m에 남산공원, 40m에 염강나들목으로 이어집니다. 서울의 계절·날씨를 풍경에 반영합니다.

게임 종료 후 결과 카드를 PNG 이미지로 공유·저장할 수 있습니다. ‘게임 링크 복사’는 브라우저 기록 안내 옆에 있습니다. 기록은 해당 브라우저와 사이트 주소에 저장되므로 기존 Sites 주소의 기록이 새 주소로 자동 이전되지는 않습니다.

## 개발과 검증

Node.js 22 환경에서 `npm ci`, `npm run dev`로 실행합니다. `npm run build`는 기존 Sites 호스팅 파일까지 준비하며, `npm test`로 56개 검사를 실행합니다. `npm run build:pages`는 GitHub Pages용 정적 파일을 `dist/client`에 생성합니다.

Pages의 저장소 하위 경로는 `VITE_BASE_PATH`, 공유할 공개 주소는 `VITE_GAME_URL`로 지정합니다. 기본 공유 주소는 위 게임 링크입니다. `.github/workflows/pages.yml`이 `main` 푸시 또는 수동 실행 시 설치 → Sites 빌드 검증 → 테스트 → Pages 빌드 → 배포를 수행합니다. 저장소 Settings → Pages의 Source는 GitHub Actions입니다. 개인 배포 토큰은 저장하지 않습니다.

React/Vite와 Canvas 2D로 동작하는 정적 앱이며, 계정이나 별도 서버를 사용하지 않습니다. 날씨는 [Open-Meteo](https://open-meteo.com/)에서 덕수궁 좌표 기준으로 가져오며 방문자 위치 권한을 요청하지 않습니다. 연결 실패 시 계절 풍경으로 계속 플레이할 수 있습니다.

## 에셋 출처

배경은 생성·편집한 일러스트입니다. 캐릭터·효과음·걷기 동작과 포팅 코드는 기존 원작 자료를 재사용한 실험용 프로토타입입니다. 원본 복사 지문은 `docs/original-motion-import.json`에 있으며, 이 저장소는 해당 자료의 상용 이용 권한이나 재라이선스를 부여하지 않습니다. npm 의존성에는 각각의 라이선스가 적용됩니다.

기존 배포: [ChatGPT Sites](https://jeomanchi-deoksugung.seonyoungyoo16.chatgpt.site/)

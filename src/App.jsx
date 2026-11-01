import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, ArrowClockwiseIcon, PauseIcon, PlayIcon, SpeakerHighIcon, SpeakerSlashIcon, ShareNetworkIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { HeronWalk } from "./game-core.mjs";
import { HeronRenderer } from "./game-renderer.mjs";
import { Footsteps } from "./game-audio.mjs";
import { soundForPose } from "./game-sound-cues.mjs";
import { DirectionInput } from "./direction-input.mjs";
import { createWeatherClient, previewWeather, seasonalWeather, weatherText, WEATHER_TTL } from "./weather.mjs";
import { locationForDistance, nextDestination } from "./walk-route.mjs";
import { createWalkRecords } from "./walk-records.mjs";
import { createPostcard, postcardDetails, sharePostcard, downloadPostcard, GAME_URL } from "./walk-postcard.mjs";
import { assetUrl } from "./deployment.mjs";

const weatherClient = createWeatherClient();
const climatePreview = import.meta.env.DEV ? previewWeather(window.location.search) : null;

export function App() {
  const canvasRef = useRef(null), gameRef = useRef(null), audioRef = useRef(null), dialogRef = useRef(null), logoRef = useRef(null);
  const controls = useRef(new DirectionInput());
  const [state, setState] = useState({ mode: "ready", distance: 0, time: 0 });
  const [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  const [sound, setSound] = useState(false), [soundNotice, setSoundNotice] = useState("");
  const [pressed, setPressed] = useState({ left: false, right: false });
  const [weather, setWeather] = useState(() => climatePreview || seasonalWeather());
  const [recordStore] = useState(() => createWalkRecords());
  const [records, setRecords] = useState(() => recordStore.read());
  const [result, setResult] = useState(null), [card, setCard] = useState(null);
  const [cardStatus, setCardStatus] = useState(""), [sharing, setSharing] = useState(false), [showLink, setShowLink] = useState(false);
  const cardSession = useRef({ token: 0, url: null });

  const clearResult = () => {
    cardSession.current.token++;
    if (cardSession.current.url) URL.revokeObjectURL(cardSession.current.url);
    cardSession.current.url = null;
    setResult(null); setCard(null); setCardStatus(""); setSharing(false); setShowLink(false);
  };

  const clearControls = () => {
    controls.current.clear();
    setPressed({ left: false, right: false });
  };
  const start = () => {
    if (!loaded || !gameRef.current) return;
    clearControls();
    if (gameRef.current.start()) {
      clearResult();
      audioRef.current?.stop();
      setState(gameRef.current.snapshot());
    }
  };
  const pause = () => {
    clearControls();
    gameRef.current?.pause();
    if (gameRef.current?.mode === "paused") audioRef.current?.stop();
    if (gameRef.current) setState(gameRef.current.snapshot());
  };
  const reset = () => {
    clearControls();
    gameRef.current?.reset();
    clearResult();
    audioRef.current?.stop();
    if (gameRef.current) setState(gameRef.current.snapshot());
  };

  useEffect(() => {
    let disposed = false, frameId;
    setLoaded(false);
    setSound(false);
    const game = new HeronWalk(), renderer = new HeronRenderer(canvasRef.current);
    renderer.setWeather(climatePreview || seasonalWeather());
    const refreshWeather = async () => {
      const climate = climatePreview || await weatherClient.load();
      if (disposed) return;
      void renderer.setWeather(climate);
      setWeather(climate);
    };
    void refreshWeather();
    const weatherTimer = setInterval(refreshWeather, WEATHER_TTL);
    const audio = new Footsteps(() => {
      if (!disposed) { setSound(false); setSoundNotice("소리를 켜지 못했어요. 소리 버튼을 다시 눌러 주세요."); }
    });
    gameRef.current = game; audioRef.current = audio;
    let last = performance.now(), lastUi = 0;
    let previousMode = "ready", lastWalking = null, roundScene = null, roundWeather = null;
    let drawnPose = { state: "ready", frame: 1 };
    const updatePressed = () => {
      const values = [...controls.current.pointers.values()];
      setPressed({
        left: controls.current.keys.has("left") || values.includes("left"),
        right: controls.current.keys.has("right") || values.includes("right"),
      });
    };
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName)) return;
      if (event.code === "Space" && event.target instanceof HTMLButtonElement) return;
      if (["ArrowLeft", "ArrowRight", "Space", "Escape", "KeyA", "KeyD", "KeyP"].includes(event.code)) event.preventDefault();
      if (event.code === "Space" && !event.repeat) {
        controls.current.clear(); updatePressed();
        if (game.mode === "paused") game.pause();
        else if (game.start()) { audio.stop(); clearResult(); }
        setState(game.snapshot());
      } else if (["Escape", "KeyP"].includes(event.code) && !event.repeat) {
        controls.current.clear();
        game.pause();
        if (game.mode === "paused") audio.stop();
        updatePressed(); setState(game.snapshot());
      } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        controls.current.keyDown("left"); updatePressed();
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        controls.current.keyDown("right"); updatePressed();
      }
    };
    const onKeyUp = (event) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") controls.current.keys.delete("left");
      if (event.code === "ArrowRight" || event.code === "KeyD") controls.current.keys.delete("right");
      updatePressed();
    };
    const onLeave = () => {
      controls.current.clear(); updatePressed();
      if (game.mode === "walking") { game.pause(); audio.stop(); setState(game.snapshot()); }
    };
    const onVisibility = () => { if (document.hidden) onLeave(); else void refreshWeather(); };
    const tick = (now) => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      game.advance(dt, () => controls.current.read());
      if (game.mode === "walking" && ["ready", "result"].includes(previousMode)) {
        lastWalking = null; roundScene = null; roundWeather = null;
      }
      if (game.mode === "falling" && previousMode === "walking" && lastWalking) {
        roundWeather = { ...renderer.weather };
        try { roundScene = renderer.captureScene(lastWalking); } catch { roundScene = null; }
      }
      renderer.render(game, dt);
      if (game.mode === "walking") lastWalking = game.snapshot();
      if (game.mode === "result" && previousMode !== "result") {
        const round = recordStore.finish(game.distance);
        const details = postcardDetails(round, roundWeather || renderer.weather);
        setRecords(recordStore.read()); setResult({ ...round, details });
        const token = cardSession.current.token;
        setCardStatus("산책 카드를 만들고 있어요.");
        if (roundScene) {
          createPostcard(roundScene, details, logoRef.current).then((postcard) => {
            if (disposed || token !== cardSession.current.token) return;
            const url = URL.createObjectURL(postcard.blob);
            cardSession.current.url = url; setCard({ ...postcard, url }); setCardStatus("");
          }).catch(() => {
            if (!disposed && token === cardSession.current.token) setCardStatus("카드를 만들지 못했어요. 게임 링크는 복사할 수 있어요.");
          });
        } else setCardStatus("카드를 만들지 못했어요. 게임 링크는 복사할 수 있어요.");
      }
      previousMode = game.mode;
      if (game.mode !== "paused") {
        const pose = { state: game.mode, frame: game.frame };
        const cue = soundForPose(drawnPose, pose);
        if (cue !== null) {
          audio.step(cue);
          canvasRef.current.dataset.cue = JSON.stringify({ index: cue, frame: game.frame, mode: game.mode, time: game.time });
        }
        drawnPose = pose;
      }
      if (now - lastUi > 90) {
        canvasRef.current.dataset.audio = JSON.stringify({
          enabled: audio.enabled, ready: audio.ready, failed: audio.failed,
          lastCue: audio.lastCue, cues: audio.cues,
          media: audio.elements.map((element) => ({ readyState: element.readyState, paused: element.paused, error: element.error?.code || null })),
        });
        setState(game.snapshot()); lastUi = now;
      }
      frameId = requestAnimationFrame(tick);
    };
    renderer.load().then(() => {
      if (disposed) return;
      setLoaded(true); last = performance.now();
      frameId = requestAnimationFrame(tick);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
      window.heronPrototype = Object.freeze({
        getState: () => game.snapshot(),
        getRenderStats: () => structuredClone(renderer.stats),
        getAudioState: () => ({ enabled: audio.enabled, ready: audio.ready, failed: audio.failed, lastCue: audio.lastCue, cues: audio.cues, media: audio.elements.map((element) => ({ src: element.src, readyState: element.readyState, paused: element.paused, error: element.error?.code || null })) }),
      });
    }).catch((reason) => { if (!disposed) setError(reason.message); });
    return () => {
      disposed = true; cancelAnimationFrame(frameId);
      clearInterval(weatherTimer);
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onLeave); document.removeEventListener("visibilitychange", onVisibility);
      if (gameRef.current === game) delete window.heronPrototype;
      cardSession.current.token++;
      if (cardSession.current.url) URL.revokeObjectURL(cardSession.current.url);
      audio.close();
    };
  }, []);

  useEffect(() => {
    if (state.mode === "paused" || state.mode === "result") dialogRef.current?.querySelector(".primary-button")?.focus({ preventScroll: true });
  }, [state.mode]);

  const updateTouch = (event, direction, release = false) => {
    event.preventDefault();
    if (release) controls.current.pointers.delete(event.pointerId);
    else {
      if (gameRef.current?.mode !== "walking") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      controls.current.pointerDown(event.pointerId, direction);
    }
    const values = [...controls.current.pointers.values()];
    setPressed({
      left: controls.current.keys.has("left") || values.includes("left"),
      right: controls.current.keys.has("right") || values.includes("right"),
    });
  };
  const toggleSound = async () => {
    if (audioRef.current?.enabled) { audioRef.current.disable(); setSound(false); }
    else {
      try {
        const enabled = await audioRef.current?.enable({ preview: gameRef.current?.mode !== "walking" });
        setSound(Boolean(enabled));
        if (!enabled) setSoundNotice("이 브라우저에서는 소리를 켤 수 없어요.");
      } catch { setSoundNotice("소리를 켜지 못했어요. 한 번 더 눌러 주세요."); }
    }
  };
  const walking = state.mode === "walking" || state.mode === "falling";
  const location = locationForDistance(state.distance);
  const destination = nextDestination(state.distance);
  const saveCard = () => {
    if (!card) return;
    downloadPostcard(card); setCardStatus("");
  };
  const shareCard = async () => {
    if (!card || sharing) return;
    const token = cardSession.current.token;
    setSharing(true); setCardStatus("");
    try {
      await sharePostcard(card, { save: downloadPostcard });
    } catch {
      if (token === cardSession.current.token) setCardStatus("공유창을 열지 못했어요. 카드 저장이나 링크 복사를 이용해 주세요.");
    } finally { if (token === cardSession.current.token) setSharing(false); }
  };
  const copyLink = async () => {
    const token = cardSession.current.token;
    try {
      await navigator.clipboard.writeText(GAME_URL);
      if (token === cardSession.current.token) setCardStatus("게임 링크를 복사했어요.");
    } catch {
      if (token === cardSession.current.token) { setShowLink(true); setCardStatus("아래 링크를 길게 눌러 복사해 주세요."); }
    }
  };
  return (
    <main className="game-shell">
      <section className="game-stage" aria-label={"저만치 — " + location.name}>
        <canvas ref={canvasRef} className="scene" aria-label={"왜가리가 앞서가는 그림자를 쫓아 " + location.name + "을 걷는 게임"} />
        <header className="location">
          <h1><img ref={logoRef} className="game-logo" src={assetUrl("brand/jeomanchi-symbol.svg")} alt="저만치" width="72" height="88" /></h1>
          <p className="climate-readout" aria-label={"서울 기준 " + weatherText(weather)}
            title={weather.observedAt ? "서울 날씨 · " + new Date(weather.observedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) + " 기준" : "서울 기준 계절 풍경 · 날씨 연결이 안 되어도 바로 걸을 수 있어요."}>
            {location.name + " · " + weatherText(weather)}
          </p>
          <p className="distance" aria-label={"걸은 거리 " + Math.floor(state.distance) + "미터"}>
            {Math.floor(state.distance)} <span>m</span>
          </p>
          <div className={"destination" + (destination.reached ? " is-reached" : "")}>
            <p>{destination.reached ? `${destination.name}에 도착했어요` : `다음 · ${destination.name} ${destination.metres} m${state.distance > 0 ? ` / ${destination.remaining} m 남음` : ""}`}</p>
            <progress aria-label={destination.name + "까지 걸은 거리"} max={destination.total} value={destination.progress} />
          </div>
        </header>
        <a className="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">날씨 Open-Meteo</a>
        <div className="utilities">
          <button className="icon-button" onClick={toggleSound} disabled={!loaded} aria-label={sound ? "소리 끄기" : "소리 켜기"} aria-pressed={sound}>
            {sound ? <SpeakerHighIcon weight="fill" /> : <SpeakerSlashIcon weight="fill" />}
          </button>
          <button className="icon-button" onClick={pause}
            disabled={!loaded || ["ready", "result", "falling"].includes(state.mode)}
            aria-label={state.mode === "paused" ? "계속 걷기" : "잠시 멈추기"}>
            {state.mode === "paused" ? <PlayIcon weight="fill" /> : <PauseIcon weight="fill" />}
          </button>
        </div>
        {(!loaded || state.mode === "ready") && (
          <div className="start-prompt">
            <p className="start-line">{error || (!loaded ? "돌담길을 준비하고 있어요." : "저만치 앞서가는 그림자를 따라.")}</p>
            <button className="start-button" onClick={start} disabled={!loaded || Boolean(error)}>걷기 시작 <kbd>SPACE</kbd></button>
            <p className="control-hint">좌우 방향키 또는 화면 버튼으로 균형을 잡으세요.</p>
            {records.last !== null && <p className="record-summary">지난 산책 {records.last} m · 최고 {records.best} m</p>}
          </div>
        )}
        {(state.mode === "paused" || state.mode === "result") && (
          <div className="dialog-backdrop">
            <section ref={dialogRef} className={"walk-dialog" + (state.mode === "result" ? " result-dialog" : "")} role="dialog" aria-modal="true" aria-labelledby="dialog-title"
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const buttons = dialogRef.current.querySelectorAll("button:not(:disabled), input");
                const first = buttons[0], last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
              }}>
              {state.mode === "result" && <div className="postcard-preview">
                {card ? <img src={card.url} alt={`${result.details.caption} ${result.details.afterword} ${result.details.climate}. 산책 결과 카드`} />
                  : <p>오늘의 산책 한 장</p>}
              </div>}
              <div className="result-content">
              <p className="eyebrow">{state.mode === "result" ? "오늘의 산책" : "저만치"}</p>
              <h2 id="dialog-title">{state.mode === "paused" ? "잠깐 쉬어가기" : "앗, 휘청."}</h2>
              {state.mode === "paused" ? <p className="dialog-description">다음 한 걸음을 이어가볼까요.</p> : <>
                <dl className="result-records" data-records={JSON.stringify(result)}>
                  <div><dt>이번 기록</dt><dd>{result?.score ?? Math.floor(state.distance)} <small>m</small></dd></div>
                  <div><dt>{result?.isNewBest ? "새로운 최고 기록" : "최고 기록"}</dt><dd>{records.best} <small>m</small></dd></div>
                  <div className="arrived"><dt>도착한 장소</dt><dd>{result?.location.name || location.name}</dd></div>
                </dl>
                <p className="record-note">
                  <span>{records.persistent ? "기록은 이 브라우저에 저장돼요." : "이 창이 열려 있는 동안 기록을 보관해요."}</span>
                  <button className="link-button" onClick={copyLink}>게임 링크 복사</button>
                </p>
                {showLink && <input className="share-link" aria-label="복사할 게임 링크" readOnly value={GAME_URL} onFocus={(event) => event.target.select()} />}
              </>}
              <button className="primary-button" onClick={state.mode === "paused" ? pause : start}>
                {state.mode === "paused" ? <PlayIcon weight="fill" /> : <ArrowClockwiseIcon weight="bold" />}
                {state.mode === "paused" ? "계속 걷기" : "다시 걷기"}<kbd>SPACE</kbd>
              </button>
              {state.mode === "result" && <>
                <div className="card-actions">
                  <button className="secondary-button" onClick={shareCard} disabled={!card || sharing}><ShareNetworkIcon />{sharing ? "공유 중" : "카드 공유"}</button>
                  <button className="secondary-button" onClick={saveCard} disabled={!card}><DownloadSimpleIcon />카드 저장</button>
                </div>
                <p className="card-status" role="status">{cardStatus}</p>
              </>}
              <button className="text-button" onClick={reset}>처음으로</button>
              </div>
            </section>
          </div>
        )}
        <nav className={"balance-controls" + (walking ? " is-playing" : "")} aria-label="균형 조작">
          {[["left", ArrowLeftIcon, "왼쪽으로 균형 잡기"], ["right", ArrowRightIcon, "오른쪽으로 균형 잡기"]].map(([direction, Icon, label]) => (
            <button key={direction} className={"balance-button " + direction + (pressed[direction] ? " is-held" : "")}
              aria-label={label} aria-pressed={pressed[direction]} disabled={!walking || state.mode === "falling"}
              onPointerDown={(event) => updateTouch(event, direction)}
              onPointerUp={(event) => updateTouch(event, direction, true)}
              onPointerCancel={(event) => updateTouch(event, direction, true)}
              onLostPointerCapture={(event) => updateTouch(event, direction, true)}>
              <Icon weight="bold" />
            </button>
          ))}
        </nav>
        {state.mode === "walking" && state.time < 6 && <p className="walking-hint">기우는 쪽의 반대편을 살짝 눌러주세요.</p>}
        <p className="sr-only" aria-live="polite">{state.mode === "result" ? "넘어졌어요. 스페이스바로 다시 걸을 수 있어요." : ""}</p>
        {soundNotice && <p className="sound-notice" role="status" onClick={() => setSoundNotice("")}>{soundNotice}</p>}
      </section>
    </main>
  );
}

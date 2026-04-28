import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

/**
 * SchoolAnthemPlayer
 * - Floating play button + animated equalizer bars when audio is playing.
 * - Reads anthem_url + anthem_autoplay from the public settings already fetched
 *   by the dashboard. If the browser blocks autoplay we silently fall back to manual.
 */
export default function SchoolAnthemPlayer({ src, autoplay = false, schoolName }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    if (!src) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.6;
    if (autoplay) {
      const tryPlay = async () => {
        try {
          await audio.play();
          setPlaying(true);
        } catch {
          // Most browsers block autoplay until the user interacts with the page.
          setAutoplayBlocked(true);
        }
      };
      tryPlay();
    }
    const onEnd = () => setPlaying(false);
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, [src, autoplay]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
        setAutoplayBlocked(false);
      } catch {
        // ignore
      }
    }
  };

  if (!src) return null;

  return (
    <div
      className="flex items-center gap-3 bg-white/90 backdrop-blur rounded-full pl-2 pr-4 py-2 shadow-md border border-slate-200"
      data-testid="school-anthem-player"
    >
      <button
        onClick={toggle}
        aria-label={playing ? "Pausar himno" : "Reproducir himno"}
        data-testid="anthem-play-toggle"
        className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-all ${
          playing ? "bg-rose-500 hover:bg-rose-600" : "bg-violet-600 hover:bg-violet-700"
        }`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      {/* Equalizer bars */}
      <div className="flex items-end gap-[3px] h-6" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className="anthem-eq-bar"
            data-active={playing}
            style={{
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      <div className="hidden sm:flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Himno
        </span>
        <span className="text-xs font-semibold text-slate-700 truncate max-w-[180px]">
          {schoolName || "del colegio"}
        </span>
      </div>

      {autoplayBlocked && !playing && (
        <span className="hidden md:inline text-[10px] text-amber-600 font-medium">
          Toca play para escuchar
        </span>
      )}

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}

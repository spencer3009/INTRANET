import { useState, useRef, useEffect } from "react";
import { Play, X } from "lucide-react";

const VIDEO_URL = "https://chatterpal.me/uploads/media/8534/a1/50/a15061d0225b9bc9c59b7bab9826fd4ced673b7a.mp4";
const STORAGE_KEY = "floating-video-closed";

export default function FloatingVideoAvatar() {
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) !== "true");
  const [playing, setPlaying] = useState(false);
  const [entered, setEntered] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handlePlay = () => {
    videoRef.current?.play();
    setPlaying(true);
  };

  const handleClose = () => {
    videoRef.current?.pause();
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!visible) return null;

  return (
    <div
      data-testid="floating-video-avatar"
      className="fixed bottom-5 right-5 z-[9999] transition-all duration-500 ease-out"
      style={{
        width: 280,
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(30px)",
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        data-testid="floating-video-close-btn"
        className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors shadow-lg"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Video container */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl cursor-pointer" style={{ mixBlendMode: "lighten" }}>
        <video
          ref={videoRef}
          src={VIDEO_URL}
          loop
          playsInline
          muted
          preload="metadata"
          className="w-full block rounded-2xl"
          style={{ mixBlendMode: "lighten" }}
          onClick={playing ? () => { videoRef.current?.pause(); setPlaying(false); } : handlePlay}
          onEnded={() => setPlaying(false)}
        />

        {/* Play overlay */}
        {!playing && (
          <button
            onClick={handlePlay}
            data-testid="floating-video-play-btn"
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors rounded-2xl"
          >
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
              <Play className="w-7 h-7 text-slate-800 ml-1" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

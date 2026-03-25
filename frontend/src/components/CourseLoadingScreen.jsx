import { useState, useEffect, useRef } from "react";
import { BookOpen } from "lucide-react";

const loadingStyles = `
  @keyframes clsLoaderSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes clsLoaderPulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.08); }
  }
  @keyframes clsLoaderFadeUp {
    0% { opacity: 0; transform: translateY(12px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes clsLoaderDot {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }
`;

export default function CourseLoadingScreen() {
  const [progress, setProgress] = useState(0);
  const pRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      let p = pRef.current;
      if (p < 30) p += 4;
      else if (p < 60) p += 2.5;
      else if (p < 85) p += 1;
      else if (p < 95) p += 0.3;
      else p = Math.min(p + 0.1, 99);

      pRef.current = p;
      setProgress(Math.round(p));
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <>
      <style>{loadingStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100 flex items-center justify-center">
        <div
          className="flex flex-col items-center gap-6 px-6"
          style={{ animation: "clsLoaderFadeUp 0.4s ease-out both" }}
        >
          {/* Animated icon */}
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-full"
              style={{
                border: "2px solid rgba(99, 102, 241, 0.15)",
                borderTopColor: "#6366F1",
                animation: "clsLoaderSpin 1.2s linear infinite",
              }}
            />
            <div
              className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                boxShadow: "0 20px 40px -8px rgba(99, 102, 241, 0.4)",
                animation: "clsLoaderPulse 2s ease-in-out infinite",
              }}
            >
              <BookOpen className="w-10 h-10 text-white" strokeWidth={1.5} />
            </div>
          </div>

          {/* Percentage number */}
          <div
            className="font-extrabold leading-none text-center"
            style={{
              fontSize: "52px",
              letterSpacing: "-3px",
              background: "linear-gradient(135deg, #6366F1, #7C3AED)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontVariantNumeric: "tabular-nums",
              minWidth: "130px",
            }}
          >
            {progress}%
          </div>

          {/* Text */}
          <div className="text-center -mt-2">
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Cargando curso
            </h2>
            <p className="text-sm text-slate-500 flex items-center justify-center gap-1">
              Preparando tu espacio de trabajo
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block w-1 h-1 bg-slate-400 rounded-full"
                  style={{
                    animation: "clsLoaderDot 1.4s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #6366F1, #7C3AED, #6366F1)",
                backgroundSize: "200% 100%",
                transition: "width 0.1s linear",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

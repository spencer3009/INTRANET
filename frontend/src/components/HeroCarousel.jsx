import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";

function StaticHero({ schoolName, title, description }) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-xl" data-testid="hero-carousel">
      <div className="relative h-[200px] md:h-[280px] lg:h-[320px]">
        {/* Pure CSS gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#001f4b] via-[#0a3068] to-[#1a4a8a]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#e1b82c]/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-white/[0.03] rounded-full translate-y-1/2" />
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-[#e1b82c]/[0.04] rounded-full" />
          <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-[0.06]">
            <GraduationCap className="w-48 h-48 text-white" strokeWidth={1} />
          </div>
        </div>
        {/* Content */}
        <div className="absolute inset-0 z-20 flex items-center">
          <div className="px-6 md:px-10 lg:px-12 w-2/3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#e1b82c]/20 border border-[#e1b82c] rounded-full mb-4">
              <span className="w-2.5 h-2.5 bg-[#e1b82c] rounded-full animate-pulse" />
              <span className="text-[#e1b82c] text-sm font-bold tracking-wide">PORTAL ACTIVO</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
              {title || "Bienvenidos a la Intranet"}
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              {description || `${schoolName || "Sistema de gestión educativa"} — Plataforma integral para la comunidad educativa`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroCarousel({ banners = [], user, schoolName }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [failedImages, setFailedImages] = useState(new Set());

  const validBanners = banners.filter(b => b.image_url && !failedImages.has(b.id));

  useEffect(() => {
    if (validBanners.length <= 1) return;
    const interval = setInterval(() => { handleNext(); }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, validBanners.length]);

  const handlePrev = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(prev => (prev === 0 ? validBanners.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 500);
  }, [validBanners.length, isTransitioning]);

  const handleNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(prev => (prev === validBanners.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), 500);
  }, [validBanners.length, isTransitioning]);

  const handleDotClick = (index) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  // No valid banners → static hero with gradient
  if (validBanners.length === 0) {
    return <StaticHero schoolName={schoolName} />;
  }

  // Has banners → carousel
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-xl group" data-testid="hero-carousel">
      <div className="relative h-[200px] md:h-[280px] lg:h-[320px]">
        {validBanners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <img
              src={banner.image_url}
              alt={`Banner ${index + 1}`}
              className="w-full h-full object-cover"
              onError={() => setFailedImages(prev => new Set(prev).add(banner.id))}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#001f4b]/90 via-[#001f4b]/60 to-transparent" />
          </div>
        ))}

        {/* Content */}
        <div className="absolute inset-0 z-20 flex items-center">
          <div className="px-6 md:px-10 lg:px-12 w-1/2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#e1b82c]/20 border border-[#e1b82c] rounded-full mb-4">
              <span className="w-2.5 h-2.5 bg-[#e1b82c] rounded-full animate-pulse" />
              <span className="text-[#e1b82c] text-sm font-bold tracking-wide">PORTAL ACTIVO</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
              {validBanners[currentIndex]?.title || "Bienvenidos a la Intranet"}
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              {validBanners[currentIndex]?.description || `${schoolName || "Sistema de gestión educativa"} — Plataforma integral para la comunidad educativa`}
            </p>
          </div>
        </div>

        {validBanners.length > 1 && (
          <>
            <button onClick={handlePrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100" aria-label="Anterior">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={handleNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100" aria-label="Siguiente">
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {validBanners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
            {validBanners.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentIndex ? "bg-white w-8" : "bg-white/50 hover:bg-white/70"}`}
                aria-label={`Ir a banner ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

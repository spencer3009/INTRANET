import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";

// Default banner when no custom banners exist
const DEFAULT_BANNER = {
  id: "default",
  image_url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1920&h=400",
  active: true
};

export default function HeroCarousel({ banners = [], user, schoolName }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Use active banners or default
  const activeBanners = banners.length > 0 ? banners : [DEFAULT_BANNER];
  
  // Auto-advance carousel
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    
    const interval = setInterval(() => {
      handleNext();
    }, 5000); // Change every 5 seconds
    
    return () => clearInterval(interval);
  }, [currentIndex, activeBanners.length]);
  
  const handlePrev = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(prev => (prev === 0 ? activeBanners.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 500);
  }, [activeBanners.length, isTransitioning]);
  
  const handleNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(prev => (prev === activeBanners.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), 500);
  }, [activeBanners.length, isTransitioning]);
  
  const handleDotClick = (index) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-xl group" data-testid="hero-carousel">
      {/* Carousel Container */}
      <div className="relative h-[200px] md:h-[280px] lg:h-[320px]">
        {/* Images */}
        {activeBanners.map((banner, index) => (
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
              onError={(e) => {
                e.target.src = DEFAULT_BANNER.image_url;
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#001f4b]/90 via-[#001f4b]/60 to-transparent" />
          </div>
        ))}
        
        {/* Content Overlay - Dynamic based on current banner */}
        <div className="absolute inset-0 z-20 flex items-center">
          <div className="px-6 md:px-10 lg:px-12 w-1/2">
            <p className="text-white/80 text-sm md:text-base font-medium mb-1">
              {getGreeting()}, {user?.name?.split(" ")[0] || "Usuario"}
            </p>
            <h1 
              className="text-2xl md:text-3xl lg:text-4xl font-black text-white mb-3"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              {activeBanners[currentIndex]?.title || "Bienvenidos a la Intranet"}
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              {activeBanners[currentIndex]?.description || `${schoolName || "Sistema de gestión educativa"} • Plataforma integral para la comunidad educativa`}
            </p>
          </div>
        </div>
        
        {/* Navigation Arrows - Only show if multiple banners */}
        {activeBanners.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
        
        {/* Dots Indicator - Only show if multiple banners */}
        {activeBanners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
            {activeBanners.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-white w-8"
                    : "bg-white/50 hover:bg-white/70"
                }`}
                aria-label={`Ir a banner ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

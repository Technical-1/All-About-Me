/**
 * useAnimatedPreview Hook
 *
 * Manages animated GIF previews for project cards:
 * - Desktop: Shows GIF on hover
 * - Mobile: Shows GIF when card is centered in viewport (via IntersectionObserver)
 * - Respects prefers-reduced-motion accessibility setting
 * - Lazy loads GIFs only when needed
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAnimatedPreviewOptions {
  pngPath: string;
  gifPath: string;
  mobileThreshold?: number; // Intersection ratio to trigger animation (default: 0.65)
}

interface UseAnimatedPreviewReturn {
  currentSrc: string;
  isAnimating: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  gifExists: boolean;
  isMobile: boolean;
}

export function useAnimatedPreview({
  pngPath,
  gifPath,
  mobileThreshold = 0.65,
}: UseAnimatedPreviewOptions): UseAnimatedPreviewReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [gifExists, setGifExists] = useState(false);
  const [gifLoaded, setGifLoaded] = useState(false);

  // Detect mobile vs desktop and reduced motion preference
  useEffect(() => {
    const checkEnvironment = () => {
      // Use pointer: coarse as primary mobile indicator (more reliable than width)
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouchDevice || isSmallScreen);

      // Check for reduced motion preference
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setPrefersReducedMotion(reducedMotion);
    };

    checkEnvironment();

    // Listen for changes (e.g., user rotates device or changes settings)
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    window.addEventListener('resize', checkEnvironment);

    return () => {
      window.removeEventListener('resize', checkEnvironment);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Check if GIF exists (one-time check)
  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip GIF entirely if user prefers reduced motion
      setGifExists(false);
      return;
    }

    const img = new Image();
    img.onload = () => setGifExists(true);
    img.onerror = () => setGifExists(false);
    img.src = gifPath;
  }, [gifPath, prefersReducedMotion]);

  // Preload GIF into browser cache when needed
  const preloadGif = useCallback(() => {
    if (gifLoaded || !gifExists || prefersReducedMotion) return;

    const img = new Image();
    img.onload = () => setGifLoaded(true);
    img.src = gifPath;
  }, [gifPath, gifLoaded, gifExists, prefersReducedMotion]);

  // Mobile: IntersectionObserver for scroll-triggered animation
  useEffect(() => {
    if (!isMobile || !containerRef.current || !gifExists || prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Consider "centered" when threshold% visible
          setIsInView(entry.intersectionRatio >= mobileThreshold);

          // Preload when partially visible (10%)
          if (entry.intersectionRatio >= 0.1) {
            preloadGif();
          }
        });
      },
      {
        threshold: [0, 0.1, 0.3, 0.5, mobileThreshold, 0.8, 1.0],
        rootMargin: '50px 0px', // Start observing slightly before visible
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMobile, gifExists, mobileThreshold, preloadGif, prefersReducedMotion]);

  // Desktop hover handlers
  const onMouseEnter = useCallback(() => {
    if (!isMobile && !prefersReducedMotion) {
      setIsHovering(true);
      preloadGif();
    }
  }, [isMobile, preloadGif, prefersReducedMotion]);

  const onMouseLeave = useCallback(() => {
    if (!isMobile) {
      setIsHovering(false);
    }
  }, [isMobile]);

  // Determine if we should animate
  const shouldAnimate = gifExists && gifLoaded && !prefersReducedMotion &&
    (isMobile ? isInView : isHovering);

  const currentSrc = shouldAnimate ? gifPath : pngPath;

  return {
    currentSrc,
    isAnimating: shouldAnimate,
    containerRef,
    onMouseEnter,
    onMouseLeave,
    gifExists,
    isMobile,
  };
}

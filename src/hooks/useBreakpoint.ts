import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'mobile';
  if (window.matchMedia('(min-width: 1024px)').matches) return 'desktop';
  if (window.matchMedia('(min-width: 768px)').matches) return 'tablet';
  return 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    const tabletMq = window.matchMedia('(min-width: 768px)');
    const desktopMq = window.matchMedia('(min-width: 1024px)');

    const update = () => {
      if (desktopMq.matches) setBreakpoint('desktop');
      else if (tabletMq.matches) setBreakpoint('tablet');
      else setBreakpoint('mobile');
    };

    update();
    tabletMq.addEventListener('change', update);
    desktopMq.addEventListener('change', update);
    return () => {
      tabletMq.removeEventListener('change', update);
      desktopMq.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}

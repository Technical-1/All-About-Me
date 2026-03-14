import { useState, useEffect, useRef, Children, type ReactNode } from 'react';

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

interface TabbedGuideProps {
  tabs: string[];
  children: ReactNode;
}

export default function TabbedGuide({ tabs, children }: TabbedGuideProps) {
  const childArray = Children.toArray(children);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  function getTabIndexFromHash(): number {
    if (typeof window === 'undefined') return 0;
    const hash = window.location.hash.slice(1);
    if (!hash) return 0;
    const index = tabs.findIndex((tab) => slugify(tab) === hash);
    return index >= 0 ? index : 0;
  }

  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActiveTab(getTabIndexFromHash());

    function handlePopState() {
      setActiveTab(getTabIndexFromHash());
    }

    function handleAfterSwap() {
      setActiveTab(getTabIndexFromHash());
    }

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('astro:after-swap', handleAfterSwap);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('astro:after-swap', handleAfterSwap);
    };
  }, []);

  function switchTab(index: number) {
    setActiveTab(index);
    const slug = slugify(tabs[index]);
    history.pushState(null, '', `#${slug}`);

    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div>
      {/* Tab Bar */}
      <div
        ref={tabBarRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '2px solid var(--border-color)',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            scrollbarWidth: 'none',
          }}
        >
          {tabs.map((tab, index) => {
            const isActive = mounted ? index === activeTab : index === 0;
            return (
              <button
                key={tab}
                onClick={() => switchTab(index)}
                style={{
                  scrollSnapAlign: 'start',
                  padding: '0.75rem 1.25rem',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: isActive ? 'var(--accent-secondary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid var(--accent-secondary)' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'color 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div ref={contentRef}>
        {childArray.map((child, index) => (
          <div
            key={index}
            style={{
              display: (!mounted || index === activeTab) ? 'block' : 'none',
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

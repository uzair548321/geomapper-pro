import { TABS, type TabId } from '../utils/sensors';

interface NavProps {
  activeTab: TabId;
  liveDots: Record<TabId, boolean>;
  onSelect: (tab: TabId) => void;
}

export function BottomNav({ activeTab, liveDots, onSelect }: NavProps) {
  return (
    <nav className="bottom-nav" aria-label="Sensor navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav-item${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onSelect(tab.id)}
          type="button"
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <span className="icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
          <span className={`dot${liveDots[tab.id] ? ' live' : ''}`} />
        </button>
      ))}
    </nav>
  );
}

export function SidebarNav({ activeTab, liveDots, onSelect }: NavProps) {
  return (
    <nav className="sidebar-nav" aria-label="Sensor navigation">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">⛏</span>
        <span className="sidebar-brand-text">GeoMapper</span>
      </div>
      <div className="sidebar-links">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onSelect(tab.id)}
            type="button"
            aria-current={activeTab === tab.id ? 'page' : undefined}
            title={tab.label}
          >
            <span className="icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
            <span className={`dot${liveDots[tab.id] ? ' live' : ''}`} />
          </button>
        ))}
      </div>
    </nav>
  );
}

interface StatusBadgesProps {
  liveDots: Record<TabId, boolean>;
}

export function StatusBadges({ liveDots }: StatusBadgesProps) {
  return (
    <div className="status-badges" aria-label="Live sensor status">
      {TABS.filter((t) => t.id === 'gps' || t.id === 'compass' || t.id === 'camera').map((tab) => (
        <span
          key={tab.id}
          className={`status-badge${liveDots[tab.id] ? ' live' : ''}`}
        >
          <span className="status-badge-icon">{tab.icon}</span>
          <span className="status-badge-label">{tab.label}</span>
          <span className="status-badge-dot" aria-hidden="true" />
        </span>
      ))}
    </div>
  );
}

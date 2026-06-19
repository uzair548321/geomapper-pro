import { useState } from 'react';
import { CameraTab } from './components/CameraTab';
import { CompassTab } from './components/CompassTab';
import { DiagnosticsTab } from './components/DiagnosticsTab';
import { ExportTab } from './components/ExportTab';
import { GpsTab } from './components/GpsTab';
import { BottomNav, SidebarNav, StatusBadges } from './components/Navigation';
import { RecordsTab } from './components/RecordsTab';
import { ReportTab } from './components/ReportTab';
import { StereonetView } from './components/StereonetView';
import { useBreakpoint } from './hooks/useBreakpoint';
import { type TabId } from './utils/sensors';

// Tabs that live in the original dashboard grid on desktop
const DASHBOARD_TABS = new Set<TabId>(['gps', 'compass', 'camera', 'diag', 'report']);

export default function App() {
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === 'desktop';

  const [activeTab, setActiveTab] = useState<TabId>('gps');
  const [liveDots, setLiveDots] = useState<Record<TabId, boolean>>({
    gps: false,
    compass: false,
    camera: false,
    stereonet: false,
    records: false,
    export: false,
    diag: false,
    report: false,
  });

  const setLive = (tab: TabId, live: boolean) => {
    setLiveDots((prev) => ({ ...prev, [tab]: live }));
  };

  const handleNavSelect = (tab: TabId) => {
    setActiveTab(tab);
    if (isDesktop && DASHBOARD_TABS.has(tab)) {
      document.getElementById(`panel-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // All 5 original sensor panels — rendered simultaneously in dashboard grid on desktop
  const sensorPanels = (
    <>
      <section className="panel-section" id="panel-gps" aria-label="GPS">
        <GpsTab onLiveChange={(live) => setLive('gps', live)} />
      </section>
      <section className="panel-section" id="panel-compass" aria-label="Compass and Dip">
        <CompassTab onLiveChange={(live) => setLive('compass', live)} />
      </section>
      <section className="panel-section" id="panel-camera" aria-label="Camera">
        <CameraTab onLiveChange={(live) => setLive('camera', live)} />
      </section>
      <section className="panel-section panel-section--diag" id="panel-diag" aria-label="Diagnostics">
        <DiagnosticsTab />
      </section>
      <section className="panel-section panel-section--report" id="panel-report" aria-label="PDF Report">
        <ReportTab />
      </section>
    </>
  );

  // Single-tab panel (mobile/tablet always; desktop for the 3 new utility tabs)
  const tabbedPanel = (
    <>
      {activeTab === 'gps' && (
        <section className="panel-section" id="panel-gps">
          <GpsTab onLiveChange={(live) => setLive('gps', live)} />
        </section>
      )}
      {activeTab === 'compass' && (
        <section className="panel-section" id="panel-compass">
          <CompassTab onLiveChange={(live) => setLive('compass', live)} />
        </section>
      )}
      {activeTab === 'camera' && (
        <section className="panel-section" id="panel-camera">
          <CameraTab onLiveChange={(live) => setLive('camera', live)} />
        </section>
      )}
      {activeTab === 'stereonet' && (
        <section className="panel-section" id="panel-stereonet">
          <StereonetView />
        </section>
      )}
      {activeTab === 'records' && (
        <section className="panel-section" id="panel-records">
          <RecordsTab />
        </section>
      )}
      {activeTab === 'export' && (
        <section className="panel-section" id="panel-export">
          <ExportTab />
        </section>
      )}
      {activeTab === 'diag' && (
        <section className="panel-section" id="panel-diag">
          <DiagnosticsTab />
        </section>
      )}
      {activeTab === 'report' && (
        <section className="panel-section" id="panel-report">
          <ReportTab />
        </section>
      )}
    </>
  );

  // On desktop: show dashboard grid for original sensor tabs; tabbed view for utility tabs
  const showDashboard = isDesktop && DASHBOARD_TABS.has(activeTab);

  return (
    <div className="app-shell">
      <SidebarNav activeTab={activeTab} liveDots={liveDots} onSelect={handleNavSelect} />

      <div className="app-main">
        <header className="mobile-header">
          <div className="eyebrow">GeoMapper Pro · Sensor Suite v0.2</div>
          <div className="title">Field Sensor Module</div>
        </header>

        <header className="dashboard-header">
          <div className="dashboard-header-brand">
            <div className="eyebrow">GeoMapper Pro · Sensor Suite v0.2</div>
            <div className="title">Field Sensor Module</div>
          </div>
          <StatusBadges liveDots={liveDots} />
        </header>

        <main className={`content${showDashboard ? ' content--dashboard' : ''}`}>
          {showDashboard ? (
            <div className="dashboard-grid">{sensorPanels}</div>
          ) : (
            <div className="tabbed-grid">{tabbedPanel}</div>
          )}
        </main>

        <footer className="footer-note">
          GeoMapper Pro v0.2 — Sensor Suite
          <br />
          All sensor data stays on this device. Nothing is uploaded.
        </footer>
      </div>

      <BottomNav activeTab={activeTab} liveDots={liveDots} onSelect={handleNavSelect} />
    </div>
  );
}

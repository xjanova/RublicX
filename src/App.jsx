import React from 'react';
import { I18nProvider, useI18n } from './i18n.jsx';
import IOSFrame from './components/IOSFrame.jsx';
import TabBar from './components/TabBar.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import LearnScreen from './screens/LearnScreen.jsx';
import ScanScreen from './screens/ScanScreen.jsx';
import SolverScreen from './screens/SolverScreen.jsx';
import TimerScreen from './screens/TimerScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import { T } from './theme.js';

function Shell() {
  const { t } = useI18n();
  const initialTab = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      if (t && ['home', 'learn', 'scan', 'solver', 'timer', 'profile'].includes(t)) return t;
    } catch {}
    return 'home';
  }, []);
  const [tab, setTab] = React.useState(initialTab);
  const [scanResult, setScanResult] = React.useState(null);

  const onScanComplete = (result) => {
    setScanResult(result);
    setTab('solver');
  };

  const renderScreen = () => {
    switch (tab) {
      case 'home': return <HomeScreen onNavigate={setTab} />;
      case 'learn': return <LearnScreen />;
      case 'scan': return <ScanScreen onScanComplete={onScanComplete} onBack={() => setTab('home')} />;
      case 'solver': return <SolverScreen scanResult={scanResult} />;
      case 'timer': return <TimerScreen />;
      case 'profile': return <ProfileScreen />;
      default: return <HomeScreen onNavigate={setTab} />;
    }
  };

  return (
    <IOSFrame>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        {renderScreen()}
        <TabBar tab={tab} setTab={setTab} t={t} />
      </div>
    </IOSFrame>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <UpdateBanner />
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'env(safe-area-inset-top, 20px) 0 env(safe-area-inset-bottom, 20px)',
      }}>
        <Shell />
      </div>
    </I18nProvider>
  );
}

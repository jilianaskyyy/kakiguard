import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './AppContext.jsx';
import { KakiPopup, LiveCallBanner, TabBar, Toasts, TopBar } from './components/ui.jsx';
import { VerifyPopup } from './components/Verify.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Check from './pages/Check.jsx';
import CallGuard from './pages/CallGuard.jsx';
import Sos from './pages/Sos.jsx';
import Circle from './pages/Circle.jsx';
import { Community, ReportDetail, ReportNew } from './pages/Community.jsx';
import Learn from './pages/Learn.jsx';
import { Moderator, Profile } from './pages/ModProfile.jsx';
import Notifications from './pages/Notifications.jsx';
import Privacy from './pages/Privacy.jsx';

export default function App() {
  const { user, ready } = useApp();
  if (!ready) return null;
  if (!user) {
    return (
      <>
        <TopBar />
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </>
    );
  }

  return (
    <div className="shell">
      <TopBar />
      <LiveCallBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check" element={<Check />} />
        <Route path="/call" element={<CallGuard />} />
        <Route path="/sos" element={<Sos />} />
        <Route path="/circle" element={<Circle />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/:id" element={<ReportDetail />} />
        <Route path="/report/new" element={<ReportNew />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/mod" element={user.role === 'moderator' ? <Moderator /> : <Navigate to="/" />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notifications/:tab" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <TabBar />
      <Toasts />
      <KakiPopup />
      <VerifyPopup />
    </div>
  );
}

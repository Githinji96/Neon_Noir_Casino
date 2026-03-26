import { useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAdminStore, AdminRole } from '../../store/adminStore';
import { supabase } from '../../lib/supabase';

interface AdminAuthGuardProps {
  requiredRoles: AdminRole[];
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function AdminAuthGuard({ requiredRoles }: AdminAuthGuardProps) {
  const { adminProfile, loading, init } = useAdminStore();
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const [timedOut, setTimedOut] = useState(false);

  // Always call init() on mount — handles page refresh case
  // Skip if adminProfile already set (e.g. just came from login page)
  // Safety timeout: if init() takes > 6s, unblock and treat as unauthenticated
  useEffect(() => {
    if (!adminProfile) {
      init();
    } else {
      // Already authenticated (e.g. navigated from login) — clear loading immediately
      useAdminStore.setState({ loading: false });
    }
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Idle timeout
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);

    const idleCheck = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        clearInterval(idleCheck);
        await supabase.auth.signOut();
        useAdminStore.setState({ adminProfile: null, alerts: [], unreadAlertCount: 0 });
        navigate('/admin/login?reason=timeout');
      }
    }, 60_000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      clearInterval(idleCheck);
    };
  }, [navigate]);

  // Show spinner while loading (unless safety timeout hit)
  if (loading && !timedOut) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!adminProfile) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!requiredRoles.includes(adminProfile.admin_role)) {
    return <Navigate to="/" replace state={{ accessDenied: true }} />;
  }

  return <Outlet />;
}

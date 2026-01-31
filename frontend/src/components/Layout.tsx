import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;
  const isMyProfileActive = user?.id
    ? location.pathname === `/employees/${user.id}`
    : false;
  const adminLinkClass = (active: boolean) =>
    `admin-only${active ? ' active' : ''}`;

  useEffect(() => {
    if (user?.isAdmin) {
      fetchPendingCount();
      // Refresh count every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000);
      // Also refresh when navigating to/from admin page
      if (location.pathname === '/admin') {
        fetchPendingCount();
      }
      return () => {
        clearInterval(interval);
      };
    }
  }, [user?.isAdmin, location.pathname]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('/api/admin/pending-requests-count');
      setPendingCount(response.data.count);
    } catch (error) {
      console.error('Error fetching pending requests count:', error);
    }
  };

  const renderNavItems = (onNavigate?: () => void) => (
    <>
      <li>
        <Link to="/" className={isActive('/') ? 'active' : ''} onClick={onNavigate}>
          Home
        </Link>
      </li>
      <li>
        {user?.id ? (
          <Link
            to={`/employees/${user.id}`}
            className={isMyProfileActive ? 'active' : ''}
            onClick={onNavigate}
          >
            My Profile
          </Link>
        ) : (
          <span className="nav-link disabled">My Profile</span>
        )}
      </li>
      <li>
        <Link to="/employees" className={isActive('/employees') ? 'active' : ''} onClick={onNavigate}>
          Employees
        </Link>
      </li>
      <li>
        <Link to="/entitlement" className={isActive('/entitlement') ? 'active' : ''} onClick={onNavigate}>
          Entitlement
        </Link>
      </li>
      <li>
        <Link to="/timesheets" className={isActive('/timesheets') ? 'active' : ''} onClick={onNavigate}>
          Timesheets
        </Link>
      </li>
      {user?.isAdmin && (
        <>
          <li className="nav-separator" aria-hidden="true">
            <hr className="nav-separator-line" />
          </li>
          <li>
            <Link to="/technologies" className={adminLinkClass(isActive('/technologies'))} onClick={onNavigate}>
              Technologies
            </Link>
          </li>
          <li>
            <Link to="/admin" className={adminLinkClass(isActive('/admin'))} onClick={onNavigate}>
              Admin
              {pendingCount > 0 && (
                <span className="notification-badge">{pendingCount}</span>
              )}
            </Link>
          </li>
          <li>
            <Link to="/settings" className={adminLinkClass(isActive('/settings'))} onClick={onNavigate}>
              Settings
            </Link>
          </li>
          <li>
            <Link to="/reports" className={adminLinkClass(isActive('/reports'))} onClick={onNavigate}>
              Reports
            </Link>
          </li>
          <li>
            <Link to="/projects" className={adminLinkClass(isActive('/projects'))} onClick={onNavigate}>
              Projects
            </Link>
          </li>
        </>
      )}
    </>
  );

  return (
    <div className="layout">
      <div className="mobile-header">
        <Logo size="small" showText={true} />
        <button
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="user-info">
                <span>{user?.firstName} {user?.lastName}</span>
                <span className="user-role">{user?.isAdmin ? 'ADMIN' : 'EMPLOYEE'}</span>
              </div>
            </div>
            <ul className="nav-menu">
              {renderNavItems(() => setIsMobileMenuOpen(false))}
            </ul>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      )}
      <nav className="sidebar">
        <div className="sidebar-header">
          <Logo size="medium" showText={true} />
          <div className="user-info">
            <span>{user?.firstName} {user?.lastName}</span>
            <span className="user-role">{user?.isAdmin ? 'ADMIN' : 'EMPLOYEE'}</span>
          </div>
        </div>
        <ul className="nav-menu">
          {renderNavItems()}
        </ul>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

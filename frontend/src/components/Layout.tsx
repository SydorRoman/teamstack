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

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('/api/admin/pending-requests-count');
      setPendingCount(response.data.count);
    } catch (error) {
      console.error('Error fetching pending requests count:', error);
    }
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <Logo size="medium" showText={true} />
          <div className="user-info">
            <span>{user?.firstName} {user?.lastName}</span>
            <span className="user-role">{user?.isAdmin ? 'ADMIN' : 'EMPLOYEE'}</span>
          </div>
        </div>
        <ul className="nav-menu">
          <li>
            <Link to="/" className={isActive('/') ? 'active' : ''}>
              Home
            </Link>
          </li>
          <li>
            {user?.id ? (
              <Link
                to={`/employees/${user.id}`}
                className={isMyProfileActive ? 'active' : ''}
              >
                My Profile
              </Link>
            ) : (
              <span className="nav-link disabled">My Profile</span>
            )}
          </li>
          <li>
            <Link to="/employees" className={isActive('/employees') ? 'active' : ''}>
              Employees
            </Link>
          </li>
          <li>
            <Link to="/entitlement" className={isActive('/entitlement') ? 'active' : ''}>
              Entitlement
            </Link>
          </li>
          <li>
            <Link to="/timesheets" className={isActive('/timesheets') ? 'active' : ''}>
              Timesheets
            </Link>
          </li>
          {user?.isAdmin && (
            <>
              <li className="nav-separator" aria-hidden="true">
                <hr className="nav-separator-line" />
              </li>
              <li>
                <Link to="/technologies" className={adminLinkClass(isActive('/technologies'))}>
                  Technologies
                </Link>
              </li>
              <li>
                <Link to="/admin" className={adminLinkClass(isActive('/admin'))}>
                  Admin
                  {pendingCount > 0 && (
                    <span className="notification-badge">{pendingCount}</span>
                  )}
                </Link>
              </li>
              <li>
                <Link to="/settings" className={adminLinkClass(isActive('/settings'))}>
                  Settings
                </Link>
              </li>
              <li>
                <Link to="/reports" className={adminLinkClass(isActive('/reports'))}>
                  Reports
                </Link>
              </li>
              <li>
                <Link to="/projects" className={adminLinkClass(isActive('/projects'))}>
                  Projects
                </Link>
              </li>
            </>
          )}
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

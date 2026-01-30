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
            <Link to="/employees" className={location.pathname.startsWith('/employees') ? 'active' : ''}>
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
          <li>
            <Link to="/technologies" className={isActive('/technologies') ? 'active' : ''}>
              Technologies
            </Link>
          </li>
          {user?.isAdmin && (
            <>
              <li>
                <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>
                  Admin
                  {pendingCount > 0 && (
                    <span className="notification-badge">{pendingCount}</span>
                  )}
                </Link>
              </li>
              <li>
                <Link to="/reports" className={isActive('/reports') ? 'active' : ''}>
                  Reports
                </Link>
              </li>
              <li>
                <Link to="/projects" className={isActive('/projects') ? 'active' : ''}>
                  Projects
                </Link>
              </li>
              <li>
                <Link to="/technology-search" className={isActive('/technology-search') ? 'active' : ''}>
                  Search People
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

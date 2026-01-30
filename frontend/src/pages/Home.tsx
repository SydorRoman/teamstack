import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { startOfMonth, endOfMonth } from 'date-fns';
import { AbsenceForm, AbsenceFormData } from './AbsenceForm';
import { MonthlyCalendar } from '../components/MonthlyCalendar';
import { CalendarLegend } from '../components/CalendarLegend';
import './Home.css';

interface Absence {
  id: string;
  type: 'sick_leave' | 'day_off' | 'vacation';
  from: string;
  to: string;
  status: 'pending' | 'approved' | 'rejected';
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function Home() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState<string>('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (users.length > 0 || selectedUserId === '') {
      fetchAbsences();
    }
  }, [showAll, selectedProject, selectedUserId, currentDate, users.length]);

  const fetchAbsences = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (showAll) params.showAll = 'true';
      if (selectedProject) params.projectId = selectedProject;
      if (selectedUserId) {
        // Use userId for filtering instead of search
        const user = users.find(u => u.id === selectedUserId);
        if (user) {
          params.search = user.id;
        }
      }

      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      params.startDate = start.toISOString();
      params.endDate = end.toISOString();

      const response = await axios.get('/api/absences', { params });
      setAbsences(response.data);
    } catch (error) {
      console.error('Error fetching absences:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/admin/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/employees');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateAbsence = async (data: AbsenceFormData) => {
    if (!data.dateRange?.from || !data.dateRange?.to) {
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        type: data.type,
        from: data.dateRange.from,
        to: data.dateRange.to,
      };

      await axios.post('/api/absences', payload);
      setShowModal(false);
      fetchAbsences();
    } catch (error: any) {
      console.error('Error creating absence:', error);
      alert(error.response?.data?.error || 'Failed to create absence');
    } finally {
      setIsCreating(false);
    }
  };

  // Get unique employees from absences for the legend (excluding rejected)
  const employees = useMemo(() => {
    const employeeMap = new Map<string, { id: string; firstName: string; lastName: string }>();
    absences.forEach((absence) => {
      // Exclude rejected absences from legend
      if (absence.status !== 'rejected' && !employeeMap.has(absence.user.id)) {
        employeeMap.set(absence.user.id, {
          id: absence.user.id,
          firstName: absence.user.firstName,
          lastName: absence.user.lastName,
        });
      }
    });
    return Array.from(employeeMap.values()).sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [absences]);

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
  };

  const getSelectedUserName = () => {
    if (!selectedUserId) return '';
    const user = users.find(u => u.id === selectedUserId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  };

  const filteredUsers = userSearch
    ? users.filter(user => {
        const searchLower = userSearch.toLowerCase();
        return (
          user.firstName.toLowerCase().includes(searchLower) ||
          user.lastName.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      })
    : users;

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const user = users.find(u => u.id === userId);
    setUserSearch(user ? `${user.firstName} ${user.lastName}` : '');
    setShowUserDropdown(false);
  };

  const handleUserClear = () => {
    setSelectedUserId('');
    setUserSearch('');
  };

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>Calendar</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          New Absence
        </button>
      </div>

      <div className="filters">
        <label className="toggle">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          <span>Show all users</span>
        </label>
        {projects.length > 0 && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="filter-select"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
        <div className="filter-group">
          <label htmlFor="userFilter">Employee:</label>
          <div className="searchable-select" ref={userSearchRef}>
            <div className="search-input-wrapper">
              <input
                id="userFilter"
                type="text"
                placeholder="Search employee..."
                value={userSearch || getSelectedUserName() || ''}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setShowUserDropdown(true);
                  if (!e.target.value) {
                    setSelectedUserId('');
                  }
                }}
                onFocus={() => setShowUserDropdown(true)}
                className="filter-select search-input"
              />
              {selectedUserId && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={handleUserClear}
                  title="Clear selection"
                >
                  ×
                </button>
              )}
            </div>
            {showUserDropdown && (
              <div className="dropdown-list">
                {filteredUsers.length === 0 ? (
                  <div className="dropdown-item no-results">No employees found</div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`dropdown-item ${selectedUserId === user.id ? 'selected' : ''}`}
                      onClick={() => handleUserSelect(user.id)}
                    >
                      {user.firstName} {user.lastName} ({user.email})
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {employees.length > 0 && <CalendarLegend employees={employees} />}
          <MonthlyCalendar
            currentDate={currentDate}
            absences={absences}
            onMonthChange={handleMonthChange}
            maxVisibleBars={3}
          />
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>New Absence</h2>
            <AbsenceForm
              onSubmit={handleCreateAbsence}
              onCancel={() => setShowModal(false)}
              loading={isCreating}
            />
          </div>
        </div>
      )}
    </div>
  );
}

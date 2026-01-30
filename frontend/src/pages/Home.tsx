import { useState, useEffect, useMemo } from 'react';
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
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [initialAbsenceValues, setInitialAbsenceValues] = useState<Partial<AbsenceFormData> | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0 || selectedUserIds.length === 0) {
      fetchAbsences();
    }
  }, [showAll, selectedProjectIds, selectedUserIds, currentDate, users.length]);

  const fetchAbsences = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (showAll) params.showAll = 'true';
      if (selectedProjectIds.length > 0) params.projectIds = selectedProjectIds;
      if (selectedUserIds.length > 0) params.userIds = selectedUserIds;

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
      if (data.type === 'sick_leave') {
        const formData = new FormData();
        formData.append('type', data.type);
        formData.append('from', data.dateRange.from);
        formData.append('to', data.dateRange.to);

        if (data.files && data.files.length > 0) {
          data.files.forEach((file) => {
            formData.append('files', file);
          });
        }

        await axios.post('/api/absences', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        const payload = {
          type: data.type,
          from: data.dateRange.from,
          to: data.dateRange.to,
        };

        await axios.post('/api/absences', payload);
      }
      setShowModal(false);
      setInitialAbsenceValues(undefined);
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

  const handleDayClick = (date: Date) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(12, 0, 0, 0);

    setInitialAbsenceValues({
      dateRange: {
        from: selectedDate.toISOString(),
        to: selectedDate.toISOString(),
      },
    });
    setShowModal(true);
  };

  const handleOpenNewAbsence = () => {
    setInitialAbsenceValues(undefined);
    setShowModal(true);
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

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    setShowAll(false);
  };

  const handleShowAllToggle = (checked: boolean) => {
    setShowAll(checked);
    if (checked) {
      setSelectedUserIds([]);
      setUserSearch('');
    }
  };

  const handleAllProjectsToggle = (checked: boolean) => {
    if (checked) {
      setSelectedProjectIds([]);
    }
  };

  const handleProjectToggle = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>Calendar</h1>
        <button className="btn-primary" onClick={handleOpenNewAbsence}>
          New Absence
        </button>
      </div>

      <div className="calendar-layout">
        <aside className="filters-panel">
          <div className="filter-section">
            <div className="filter-header">
              <span className="filter-title">Employees</span>
              <span className="filter-count">{users.length}</span>
            </div>
            <input
              id="userFilter"
              type="text"
              placeholder="Search employee..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="filter-search"
            />
            <div className="faceted-list">
              <label className="facet-option">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => handleShowAllToggle(e.target.checked)}
                />
                <span>Show all users</span>
              </label>
              {filteredUsers.length === 0 ? (
                <div className="no-results">No employees found</div>
              ) : (
                filteredUsers.map((user) => (
                  <label key={user.id} className="facet-option">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => handleUserToggle(user.id)}
                    />
                    <span>
                      {user.firstName} {user.lastName}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {projects.length > 0 && (
            <div className="filter-section">
              <div className="filter-header">
                <span className="filter-title">Projects</span>
                <span className="filter-count">{projects.length}</span>
              </div>
              <div className="faceted-list">
                <label className="facet-option">
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.length === 0}
                    onChange={(e) => handleAllProjectsToggle(e.target.checked)}
                  />
                  <span>All Projects</span>
                </label>
                {projects.map((project) => (
                  <label key={project.id} className="facet-option">
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(project.id)}
                      onChange={() => handleProjectToggle(project.id)}
                    />
                    <span>{project.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {employees.length > 0 && (
            <div className="filter-section">
              <div className="filter-header">
                <span className="filter-title">Legend</span>
                <span className="filter-count">{employees.length}</span>
              </div>
              <CalendarLegend employees={employees} />
            </div>
          )}
        </aside>

        <section className="calendar-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              <MonthlyCalendar
                currentDate={currentDate}
                absences={absences}
                onMonthChange={handleMonthChange}
                onDayClick={handleDayClick}
                maxVisibleBars={3}
              />
            </>
          )}
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>New Absence</h2>
            <AbsenceForm
              onSubmit={handleCreateAbsence}
              onCancel={() => {
                setShowModal(false);
                setInitialAbsenceValues(undefined);
              }}
              initialValues={initialAbsenceValues}
              loading={isCreating}
            />
          </div>
        </div>
      )}
    </div>
  );
}

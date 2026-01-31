import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './Reports.css';

interface WorkLog {
  id: string;
  date: string;
  start: string;
  end: string;
  projectId: string | null;
  note: string | null;
  isPastDue: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  } | null;
}

interface SummaryItem {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  totalHours: number;
  totalDays: number;
  overtime: number;
  sickLeaveHours: number;
  vacationHours: number;
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

export default function Reports() {
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Search states
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [projectSearch, setProjectSearch] = useState<string>('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const employeeSearchRef = useRef<HTMLDivElement>(null);
  const projectSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeSearchRef.current && !employeeSearchRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
      if (projectSearchRef.current && !projectSearchRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchReport();
  }, [currentMonth, selectedUserId, selectedProjectId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const month = format(currentMonth, 'yyyy-MM');
      const params = new URLSearchParams({ month });
      if (selectedUserId) params.append('userId', selectedUserId);
      if (selectedProjectId) params.append('projectId', selectedProjectId);

      const response = await axios.get(`/api/worklogs/report?${params}`);
      setWorkLogs(response.data.workLogs);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error fetching report:', error);
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


  const exportToCSV = () => {
    const headers = ['Date', 'Employee', 'Hours', 'Project', 'Note'];
    const rows = workLogs.map((log) => {
      const hours = calculateHours(log);
      return [
        format(new Date(log.date), 'yyyy-MM-dd'),
        `${log.user.firstName} ${log.user.lastName}`,
        hours.toFixed(2),
        log.project?.name || '',
        log.note || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `worklogs-${format(currentMonth, 'yyyy-MM')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const calculateHours = (log: WorkLog): number => {
    const start = new Date(log.start);
    const end = new Date(log.end);
    const totalMs = end.getTime() - start.getTime();
    return totalMs / (1000 * 60 * 60);
  };

  const getSelectedEmployeeName = () => {
    if (!selectedUserId) return '';
    const user = users.find(u => u.id === selectedUserId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  };

  const getSelectedProjectName = () => {
    if (!selectedProjectId) return '';
    const project = projects.find(p => p.id === selectedProjectId);
    return project ? project.name : '';
  };

  const filteredEmployees = employeeSearch
    ? users.filter(user => {
        const searchLower = employeeSearch.toLowerCase();
        return (
          user.firstName.toLowerCase().includes(searchLower) ||
          user.lastName.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      })
    : users;

  const filteredProjects = projectSearch
    ? projects.filter(project =>
        project.name.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : projects;

  const handleEmployeeSelect = (userId: string) => {
    setSelectedUserId(userId);
    const user = users.find(u => u.id === userId);
    setEmployeeSearch(user ? `${user.firstName} ${user.lastName}` : '');
    setShowEmployeeDropdown(false);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find(p => p.id === projectId);
    setProjectSearch(project ? project.name : '');
    setShowProjectDropdown(false);
  };

  const handleEmployeeClear = () => {
    setSelectedUserId('');
    setEmployeeSearch('');
  };

  const handleProjectClear = () => {
    setSelectedProjectId('');
    setProjectSearch('');
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Work Reports</h1>
        <button onClick={exportToCSV} className="btn-primary" disabled={workLogs.length === 0}>
          Export CSV
        </button>
      </div>

      <div className="reports-filters">
        <div className="month-selector">
          <button onClick={goToPreviousMonth} className="month-nav-button">
            ← Prev
          </button>
          <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={goToNextMonth} className="month-nav-button">
            Next →
          </button>
        </div>

        <div className="filter-group">
          <label htmlFor="userFilter">Employee:</label>
          <div className="searchable-select" ref={employeeSearchRef}>
            <div className="search-input-wrapper">
              <input
                id="userFilter"
                type="text"
                placeholder="Search employee..."
                value={employeeSearch || getSelectedEmployeeName() || ''}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setShowEmployeeDropdown(true);
                  if (!e.target.value) {
                    setSelectedUserId('');
                  }
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                className="filter-select search-input"
              />
              {selectedUserId && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={handleEmployeeClear}
                  title="Clear selection"
                >
                  ×
                </button>
              )}
            </div>
            {showEmployeeDropdown && (
              <div className="dropdown-list">
                {filteredEmployees.length === 0 ? (
                  <div className="dropdown-item no-results">No employees found</div>
                ) : (
                  filteredEmployees.map((user) => (
                    <div
                      key={user.id}
                      className={`dropdown-item ${selectedUserId === user.id ? 'selected' : ''}`}
                      onClick={() => handleEmployeeSelect(user.id)}
                    >
                      {user.firstName} {user.lastName} ({user.email})
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label htmlFor="projectFilter">Project:</label>
          <div className="searchable-select" ref={projectSearchRef}>
            <div className="search-input-wrapper">
              <input
                id="projectFilter"
                type="text"
                placeholder="Search project..."
                value={projectSearch || getSelectedProjectName() || ''}
                onChange={(e) => {
                  setProjectSearch(e.target.value);
                  setShowProjectDropdown(true);
                  if (!e.target.value) {
                    setSelectedProjectId('');
                  }
                }}
                onFocus={() => setShowProjectDropdown(true)}
                className="filter-select search-input"
              />
              {selectedProjectId && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={handleProjectClear}
                  title="Clear selection"
                >
                  ×
                </button>
              )}
            </div>
            {showProjectDropdown && (
              <div className="dropdown-list">
                {filteredProjects.length === 0 ? (
                  <div className="dropdown-item no-results">No projects found</div>
                ) : (
                  filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`dropdown-item ${selectedProjectId === project.id ? 'selected' : ''}`}
                      onClick={() => handleProjectSelect(project.id)}
                    >
                      {project.name}
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
          {summary.length > 0 && (
            <div className="summary-section">
              <h2>Summary</h2>
              <div className="summary-table-container">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Total Hours</th>
                      <th>Sick Leave Hours</th>
                      <th>Vacation Hours</th>
                      <th>Total Days</th>
                      <th>Overtime</th>
                      <th>Total Hours (Incl. Leave)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((item) => (
                      <tr key={item.userId}>
                        <td>
                          {item.firstName} {item.lastName}
                        </td>
                        <td>{item.totalHours.toFixed(2)}</td>
                        <td>{item.sickLeaveHours.toFixed(2)}</td>
                        <td>{item.vacationHours.toFixed(2)}</td>
                        <td>{item.totalDays}</td>
                        <td>{item.overtime.toFixed(2)}</td>
                        <td>{(item.totalHours + item.sickLeaveHours + item.vacationHours).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="work-logs-section">
            <h2>Work Logs</h2>
            {workLogs.length === 0 ? (
              <p className="no-data">No work logs found</p>
            ) : (
              <div className="work-logs-table-container">
                <table className="work-logs-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Hours</th>
                      <th>Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workLogs.map((log) => {
                      const hours = calculateHours(log);
                      return (
                        <tr key={log.id}>
                          <td>
                            {format(new Date(log.date), 'MMM dd, yyyy')}
                            {log.isPastDue && <span className="past-due-indicator" title="Past Due">⚠️</span>}
                          </td>
                          <td>
                            {log.user.firstName} {log.user.lastName}
                          </td>
                          <td>{hours.toFixed(2)}</td>
                          <td>{log.project?.name || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

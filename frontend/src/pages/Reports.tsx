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
  dayOffHours: number;
}

interface AbsenceItem {
  id: string;
  type: 'sick_leave' | 'day_off' | 'vacation' | 'work_from_home';
  from: string;
  to: string;
  status: 'pending' | 'approved' | 'rejected';
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  workingDays: number;
  hours: number;
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
  const [absences, setAbsences] = useState<AbsenceItem[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [selectedWorkLog, setSelectedWorkLog] = useState<WorkLog | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
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
      setAbsences(response.data.absences || []);
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
    const headers = [
      'Date',
      'Employee',
      'Hours',
      'Sick Leave Hours',
      'Vacation Hours',
      'Day Off Hours',
      'Project',
      'Note',
    ];
    const sortedLogs = [...workLogs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const workLogRows = sortedLogs.map((log) => ({
      sortTime: new Date(log.date).getTime(),
      row: [
        format(new Date(log.date), 'yyyy-MM-dd'),
        `${log.user.firstName} ${log.user.lastName}`,
        calculateHours(log).toFixed(2),
        '0.00',
        '0.00',
        '0.00',
        log.project?.name || '',
        log.note || '',
      ],
    }));

    const absenceRows = absences
      .filter((absence) =>
        absence.type === 'sick_leave' || absence.type === 'vacation' || absence.type === 'day_off'
      )
      .map((absence) => {
        const absenceFrom = new Date(absence.from);
        const absenceTo = new Date(absence.to);
        const dateLabel =
          absenceFrom.toDateString() === absenceTo.toDateString()
            ? format(absenceFrom, 'yyyy-MM-dd')
            : `${format(absenceFrom, 'yyyy-MM-dd')} - ${format(absenceTo, 'yyyy-MM-dd')}`;
        const sickLeaveHours = absence.type === 'sick_leave' ? absence.hours : 0;
        const vacationHours = absence.type === 'vacation' ? absence.hours : 0;
        const dayOffHours = absence.type === 'day_off' ? absence.hours : 0;
        return {
          sortTime: absenceFrom.getTime(),
          row: [
            dateLabel,
            `${absence.user.firstName} ${absence.user.lastName}`,
            '0.00',
            sickLeaveHours.toFixed(2),
            vacationHours.toFixed(2),
            dayOffHours.toFixed(2),
            getAbsenceLabel(absence.type),
            '',
          ],
        };
      });

    const rows = [...workLogRows, ...absenceRows]
      .sort((a, b) => a.sortTime - b.sortTime)
      .map((item) => item.row);

    const totalWorkHours = workLogs.reduce((sum, log) => sum + calculateHours(log), 0);
    const totalSickLeaveHours = summary.reduce((sum, item) => sum + item.sickLeaveHours, 0);
    const totalVacationHours = summary.reduce((sum, item) => sum + item.vacationHours, 0);
    const totalDayOffHours = summary.reduce((sum, item) => sum + item.dayOffHours, 0);

    rows.push([
      'TOTAL',
      '',
      totalWorkHours.toFixed(2),
      totalSickLeaveHours.toFixed(2),
      totalVacationHours.toFixed(2),
      totalDayOffHours.toFixed(2),
      '',
      '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const sanitizeFilePart = (value: string) =>
      value.trim().replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/_+/g, '_');
    const userPart = getSelectedEmployeeName();
    const projectPart = getSelectedProjectName();
    const filenameParts = [
      'worklogs',
      format(currentMonth, 'yyyy-MM'),
      userPart ? sanitizeFilePart(userPart) : '',
      projectPart ? sanitizeFilePart(projectPart) : '',
    ].filter(Boolean);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filenameParts.join('-')}.csv`);
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

  const getAbsenceLabel = (type: AbsenceItem['type']) => {
    switch (type) {
      case 'vacation':
        return 'Vacation';
      case 'sick_leave':
        return 'Sick Leave';
      case 'day_off':
        return 'Day Off';
      case 'work_from_home':
        return 'Work from Home';
      default:
        return type;
    }
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
            {workLogs.length === 0 && absences.length === 0 ? (
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
                    {[
                      ...workLogs.map((log) => ({
                        key: `worklog-${log.id}`,
                        kind: 'worklog' as const,
                        sortTime: new Date(log.date).getTime(),
                        log,
                      })),
                      ...absences.map((absence) => ({
                        key: `absence-${absence.id}`,
                        kind: 'absence' as const,
                        sortTime: new Date(absence.from).getTime(),
                        absence,
                      })),
                    ]
                      .sort((a, b) => b.sortTime - a.sortTime)
                      .map((row) => {
                        if (row.kind === 'worklog') {
                          const hours = calculateHours(row.log);
                          return (
                            <tr
                              key={row.key}
                              className="worklog-row clickable-row"
                              onClick={() => {
                                setSelectedWorkLog(row.log);
                                setShowNoteModal(true);
                              }}
                            >
                              <td>
                                {format(new Date(row.log.date), 'MMM dd, yyyy')}
                                {row.log.isPastDue && (
                                  <span className="past-due-indicator" title="Past Due">
                                    ⚠️
                                  </span>
                                )}
                              </td>
                              <td>
                                {row.log.user.firstName} {row.log.user.lastName}
                              </td>
                              <td>{hours.toFixed(2)}</td>
                              <td>{row.log.project?.name || '-'}</td>
                            </tr>
                          );
                        }

                        const absenceFrom = new Date(row.absence.from);
                        const absenceTo = new Date(row.absence.to);
                        const dateLabel =
                          absenceFrom.toDateString() === absenceTo.toDateString()
                            ? format(absenceFrom, 'MMM dd, yyyy')
                            : `${format(absenceFrom, 'MMM dd, yyyy')} - ${format(absenceTo, 'MMM dd, yyyy')}`;

                        const rowClassName =
                          row.absence.type === 'sick_leave'
                            ? 'worklog-absence worklog-absence-sick'
                            : row.absence.type === 'vacation'
                              ? 'worklog-absence worklog-absence-vacation'
                              : 'worklog-absence';

                        return (
                          <tr key={row.key} className={rowClassName}>
                            <td>{dateLabel}</td>
                            <td>
                              {row.absence.user.firstName} {row.absence.user.lastName}
                            </td>
                            <td>{row.absence.hours.toFixed(2)}</td>
                            <td>{getAbsenceLabel(row.absence.type)}</td>
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
      {showNoteModal && selectedWorkLog && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowNoteModal(false);
            setSelectedWorkLog(null);
          }}
        >
          <div className="modal-content note-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Work Log Note</h2>
            <div className="work-log-note-details">
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">
                  {format(new Date(selectedWorkLog.date), 'MMM dd, yyyy')}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Employee:</span>
                <span className="detail-value">
                  {selectedWorkLog.user.firstName} {selectedWorkLog.user.lastName}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Hours:</span>
                <span className="detail-value">{calculateHours(selectedWorkLog).toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Project:</span>
                <span className="detail-value">{selectedWorkLog.project?.name || '-'}</span>
              </div>
              <div className="detail-row note-row">
                <span className="detail-label">Note:</span>
                <div className="detail-note">
                  {selectedWorkLog.note?.trim() || 'No note provided.'}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowNoteModal(false);
                  setSelectedWorkLog(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

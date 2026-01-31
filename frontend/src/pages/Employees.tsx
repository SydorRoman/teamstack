import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Employees.css';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: { id: string; name: string } | null;
  gender: string | null;
}

interface Technology {
  id: string;
  name: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [allTechnologies, setAllTechnologies] = useState<Technology[]>([]);
  const [selectedTechnologyIds, setSelectedTechnologyIds] = useState<string[]>([]);
  const [technologySearch, setTechnologySearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    filterEmployees();
  }, [employees, searchQuery, positionFilter, genderFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [selectedTechnologyIds]);

  useEffect(() => {
    fetchTechnologies();
  }, []);

  const fetchEmployees = async () => {
    try {
      const params: any = {};
      if (selectedTechnologyIds.length > 0) {
        params.technologyIds = selectedTechnologyIds;
      }

      const response = await axios.get('/api/employees', { params });
      setEmployees(response.data);

      // Extract unique positions
      const uniquePositions: string[] = Array.from(
        new Set(
          response.data
            .map((e: Employee) => e.position?.name)
            .filter((name: string | undefined): name is string => typeof name === 'string')
        )
      );
      setPositions(uniquePositions);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const filterEmployees = () => {
    let filtered = [...employees];

    if (searchQuery) {
      const terms = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (terms.length > 0) {
        filtered = filtered.filter((emp) => {
          const firstName = emp.firstName.toLowerCase();
          const lastName = emp.lastName.toLowerCase();
          const email = emp.email.toLowerCase();
          return terms.every(
            (term) =>
              firstName.includes(term) ||
              lastName.includes(term) ||
              email.includes(term)
          );
        });
      }
    }

    if (positionFilter) {
      filtered = filtered.filter((emp) => emp.position?.name === positionFilter);
    }

    if (genderFilter) {
      filtered = filtered.filter((emp) => emp.gender === genderFilter);
    }

    setFilteredEmployees(filtered);
  };

  const fetchTechnologies = async () => {
    try {
      const response = await axios.get('/api/user-technologies/all');
      setAllTechnologies(response.data);
    } catch (error) {
      console.error('Error fetching technologies:', error);
    }
  };

  const handleTechnologyToggle = (techId: string) => {
    setSelectedTechnologyIds((prev) =>
      prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]
    );
  };

  const filteredTechnologies = allTechnologies.filter((tech) =>
    tech.name.toLowerCase().includes(technologySearch.trim().toLowerCase())
  );

  const selectedTechnologies = allTechnologies.filter((tech) =>
    selectedTechnologyIds.includes(tech.id)
  );

  return (
    <div className="employees-page">
      <div className="page-header">
        <h1>Employees</h1>
      </div>

      <div className="employees-layout">
        <aside className="filters-panel">
          <div className="filter-section">
            <div className="filter-header">
              <span className="filter-title">Search</span>
              <span className="filter-count">{employees.length}</span>
            </div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-section">
            <div className="filter-header">
              <span className="filter-title">Position</span>
              <span className="filter-count">{positions.length}</span>
            </div>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Positions</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-section">
            <div className="filter-header">
              <span className="filter-title">Gender</span>
              <span className="filter-count">3</span>
            </div>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="filter-section">
            <div className="filter-header">
              <span className="filter-title">Technologies</span>
              <span className="filter-count">{allTechnologies.length}</span>
            </div>
            <input
              type="text"
              placeholder="Search technologies..."
              value={technologySearch}
              onChange={(e) => setTechnologySearch(e.target.value)}
              className="search-input"
            />
            <div className="tech-filter-list">
              <div className="faceted-list">
                {filteredTechnologies.length === 0 ? (
                  <div className="no-results">No technologies found</div>
                ) : (
                  filteredTechnologies.map((tech) => (
                    <label key={tech.id} className="facet-option">
                      <input
                        type="checkbox"
                        checked={selectedTechnologyIds.includes(tech.id)}
                        onChange={() => handleTechnologyToggle(tech.id)}
                      />
                      <span>{tech.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            {selectedTechnologies.length > 0 && (
              <div className="selected-tech">
                <div className="selected-tech-label">Selected skills</div>
                <div className="selected-tech-list">
                  {selectedTechnologies.map((tech) => (
                    <button
                      key={tech.id}
                      type="button"
                      className="selected-tech-tag"
                      onClick={() => handleTechnologyToggle(tech.id)}
                      aria-label={`Remove ${tech.name}`}
                    >
                      {tech.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="employees-content">
          <div className="table-container">
            <table className="employees-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="no-data">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      onClick={() => navigate(`/employees/${employee.id}`)}
                      className="table-row-clickable"
                    >
                      <td>
                        <div className="avatar">
                          {employee.firstName[0]}
                          {employee.lastName[0]}
                        </div>
                      </td>
                      <td>
                        {employee.firstName} {employee.lastName}
                      </td>
                      <td>{employee.email}</td>
                      <td>{employee.position?.name || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

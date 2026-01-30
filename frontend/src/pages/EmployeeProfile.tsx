import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import './EmployeeProfile.css';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  telegram: string | null;
  birthDate: string | null;
  position: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  projects: Array<{ id: string; name: string }>;
}

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEmployee();
    }
  }, [id]);

  const fetchEmployee = async () => {
    try {
      const response = await axios.get(`/api/employees/${id}`);
      setEmployee(response.data);
    } catch (error) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!employee) {
    return <div className="error">Employee not found</div>;
  }

  return (
    <div className="employee-profile">
      <button className="back-button" onClick={() => navigate('/employees')}>
        ← Back to Employees
      </button>
      <div className="profile-header">
        <div className="profile-avatar">
          {employee.firstName[0]}
          {employee.lastName[0]}
        </div>
        <div className="profile-name">
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="profile-email">{employee.email}</p>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-section">
          <h2>Personal Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>First Name</label>
              <span>{employee.firstName}</span>
            </div>
            <div className="info-item">
              <label>Last Name</label>
              <span>{employee.lastName}</span>
            </div>
            <div className="info-item">
              <label>Email</label>
              <span>{employee.email}</span>
            </div>
            <div className="info-item">
              <label>Phone</label>
              <span>{employee.phone || '-'}</span>
            </div>
            <div className="info-item">
              <label>Telegram</label>
              <span>{employee.telegram || '-'}</span>
            </div>
            <div className="info-item">
              <label>Date of Birth</label>
              <span>
                {employee.birthDate ? format(new Date(employee.birthDate), 'MMM dd, yyyy') : '-'}
              </span>
            </div>
            <div className="info-item">
              <label>Position</label>
              <span>{employee.position || '-'}</span>
            </div>
            <div className="info-item">
              <label>Gender</label>
              <span>{employee.gender || '-'}</span>
            </div>
            <div className="info-item">
              <label>City</label>
              <span>{employee.city || '-'}</span>
            </div>
            <div className="info-item">
              <label>Country</label>
              <span>{employee.country || '-'}</span>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h2>Projects</h2>
          {employee.projects.length === 0 ? (
            <p className="no-projects">No projects assigned</p>
          ) : (
            <div className="projects-list">
              {employee.projects.map((project) => (
                <div key={project.id} className="project-tag">
                  {project.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

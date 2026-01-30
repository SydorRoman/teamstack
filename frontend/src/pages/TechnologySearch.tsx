import { useState, useEffect } from 'react';
import axios from 'axios';
import './TechnologySearch.css';

interface Technology {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: Position | null;
  technologies: Technology[];
}

export default function TechnologySearch() {
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchTechnologies();
  }, []);

  const fetchTechnologies = async () => {
    try {
      const response = await axios.get('/api/technologies');
      setTechnologies(response.data);
    } catch (error) {
      console.error('Error fetching technologies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTechToggle = (techId: string) => {
    setSelectedTechIds((prev) =>
      prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]
    );
  };

  useEffect(() => {
    const handleSearch = async () => {
      if (selectedTechIds.length === 0) {
        setUsers([]);
        return;
      }

      setSearching(true);
      try {
        const response = await axios.get('/api/technologies/search-users', {
          params: {
            technologyIds: selectedTechIds,
          },
        });
        setUsers(response.data);
      } catch (error) {
        console.error('Error searching users:', error);
        alert('Failed to search users');
      } finally {
        setSearching(false);
      }
    };

    if (selectedTechIds.length > 0) {
      handleSearch();
    } else {
      setUsers([]);
    }
  }, [selectedTechIds]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="technology-search-page">
      <div className="page-header">
        <h1>Search People by Technologies</h1>
      </div>

      <div className="search-section">
        <h2>Select Technologies</h2>
        <div className="technologies-filter">
          {technologies.map((tech) => (
            <label key={tech.id} className="filter-checkbox">
              <input
                type="checkbox"
                checked={selectedTechIds.includes(tech.id)}
                onChange={() => handleTechToggle(tech.id)}
              />
              <span className="filter-label">{tech.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="results-section">
        <h2>
          Results {selectedTechIds.length > 0 && `(${users.length} found)`}
        </h2>
        {selectedTechIds.length === 0 ? (
          <p className="no-selection">Select at least one technology to search</p>
        ) : searching ? (
          <div className="loading">Searching...</div>
        ) : users.length === 0 ? (
          <p className="no-data">No users found with the selected technologies</p>
        ) : (
          <div className="users-list">
            {users.map((user) => (
              <div key={user.id} className="user-card">
                <div className="user-header">
                  <h3>
                    {user.firstName} {user.lastName}
                  </h3>
                  <span className="user-email">{user.email}</span>
                </div>
                {user.position && (
                  <div className="user-position">{user.position.name}</div>
                )}
                <div className="user-technologies">
                  <strong>Technologies:</strong>
                  <div className="tech-tags">
                    {user.technologies.map((tech) => (
                      <span key={tech.id} className="tech-tag">
                        {tech.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


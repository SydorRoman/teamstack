import { useMemo } from 'react';
import { getUserColor, getTextColor } from '../utils/colorUtils';
import './CalendarLegend.css';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface CalendarLegendProps {
  employees: Employee[];
  maxItems?: number;
}

export function CalendarLegend({ employees, maxItems = 10 }: CalendarLegendProps) {
  const displayEmployees = useMemo(() => {
    return employees.slice(0, maxItems);
  }, [employees, maxItems]);

  if (employees.length === 0) {
    return null;
  }

  const hasMore = employees.length > maxItems;

  return (
    <div className="calendar-legend">
      <h3 className="calendar-legend-title">Legend</h3>
      <div className="calendar-legend-items">
        {displayEmployees.map((employee) => {
          const color = getUserColor(employee.id);
          const textColor = getTextColor(color) === 'light' ? '#ffffff' : '#2c3e50';

          return (
            <div key={employee.id} className="calendar-legend-item">
              <div
                className="calendar-legend-color"
                style={{
                  backgroundColor: color,
                  color: textColor,
                }}
              >
                {employee.firstName.charAt(0)}
                {employee.lastName.charAt(0)}
              </div>
              <span className="calendar-legend-name">
                {employee.firstName} {employee.lastName}
              </span>
            </div>
          );
        })}
        {hasMore && (
          <div className="calendar-legend-more">
            +{employees.length - maxItems} more
          </div>
        )}
      </div>
    </div>
  );
}

import { type MouseEvent } from 'react';
import { getUserColor, getTextColor } from '../utils/colorUtils';
import './BookingBar.css';

interface BookingBarProps {
  firstName: string;
  lastName: string;
  userId: string;
  type: 'vacation' | 'day_off' | 'sick_leave';
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  compact?: boolean;
}

export function BookingBar({
  firstName,
  lastName,
  userId,
  type,
  onClick,
  compact = false,
}: BookingBarProps) {
  const color = getUserColor(userId);
  const textColor = getTextColor(color) === 'light' ? '#ffffff' : '#2c3e50';
  const displayName = compact 
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`
    : `${firstName} ${lastName}`;

  return (
    <div
      className={`booking-bar ${compact ? 'booking-bar-compact' : ''}`}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e as unknown as MouseEvent<HTMLDivElement>);
        }
      }}
      aria-label={`${firstName} ${lastName} - ${type}`}
      title={`${firstName} ${lastName} - ${type}`}
    >
      <span className="booking-bar-name">{displayName}</span>
      {!compact && (
        <span className="booking-bar-type">{type.replace('_', ' ')}</span>
      )}
    </div>
  );
}

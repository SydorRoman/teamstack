import { format } from 'date-fns';
import { getUserColor } from '../utils/colorUtils';
import './DayBookingsModal.css';

interface Booking {
  id: string;
  firstName: string;
  lastName: string;
  userId: string;
  type: 'vacation' | 'day_off' | 'sick_leave';
  from: string;
  to: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface DayBookingsModalProps {
  date: Date;
  bookings: Booking[];
  onClose: () => void;
}

export function DayBookingsModal({ date, bookings, onClose }: DayBookingsModalProps) {
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Vacation';
      case 'sick_leave':
        return 'Sick Leave';
      case 'day_off':
        return 'Day Off';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#27ae60';
      case 'rejected':
        return '#e74c3c';
      case 'pending':
        return '#f39c12';
      default:
        return '#95a5a6';
    }
  };

  return (
    <div className="day-bookings-modal-overlay" onClick={onClose}>
      <div
        className="day-bookings-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="day-bookings-modal-header">
          <h2 id="modal-title">Bookings for {format(date, 'MMMM dd, yyyy')}</h2>
          <button
            className="day-bookings-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="day-bookings-modal-body">
          {bookings.length === 0 ? (
            <p className="no-bookings">No bookings for this day</p>
          ) : (
            <div className="bookings-list">
              {bookings.map((booking) => {
                const color = getUserColor(booking.userId);
                const fromDate = new Date(booking.from);
                const toDate = new Date(booking.to);
                const isRange = format(fromDate, 'yyyy-MM-dd') !== format(toDate, 'yyyy-MM-dd');

                return (
                  <div key={booking.id} className="booking-item">
                    <div
                      className="booking-item-color-bar"
                      style={{ backgroundColor: color }}
                    />
                    <div className="booking-item-content">
                      <div className="booking-item-header">
                        <h3 className="booking-item-name">
                          {booking.firstName} {booking.lastName}
                        </h3>
                        <span
                          className="booking-item-status"
                          style={{ color: getStatusColor(booking.status) }}
                        >
                          {booking.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="booking-item-details">
                        <span className="booking-item-type">{getTypeLabel(booking.type)}</span>
                        {isRange && (
                          <span className="booking-item-dates">
                            {format(fromDate, 'MMM dd')} - {format(toDate, 'MMM dd, yyyy')}
                          </span>
                        )}
                        {!isRange && (
                          <span className="booking-item-dates">
                            {format(fromDate, 'MMM dd, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

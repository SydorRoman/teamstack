import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { BookingBar } from './BookingBar';
import { DayBookingsModal } from './DayBookingsModal';
import './MonthlyCalendar.css';

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

interface MonthlyCalendarProps {
  currentDate: Date;
  absences: Absence[];
  onMonthChange: (date: Date) => void;
  maxVisibleBars?: number;
}

export function MonthlyCalendar({
  currentDate,
  absences,
  onMonthChange,
  maxVisibleBars = 3,
}: MonthlyCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get all bookings for a specific date
  const getBookingsForDate = (date: Date): Absence[] => {
    const dateCopy = new Date(date);
    dateCopy.setHours(12, 0, 0, 0);
    return absences.filter((absence) => {
      // Exclude rejected absences
      if (absence.status === 'rejected') {
        return false;
      }
      const from = new Date(absence.from);
      const to = new Date(absence.to);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return dateCopy >= from && dateCopy <= to;
    });
  };

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  // Get calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Sunday
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const goToPreviousMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    onMonthChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    onMonthChange(newDate);
  };

  return (
    <>
      <div className="monthly-calendar-container">
        <div className="calendar-controls">
          <button onClick={goToPreviousMonth} className="calendar-nav-button">
            ← Prev
          </button>
          <h2 className="calendar-month-title">{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={goToNextMonth} className="calendar-nav-button">
            Next →
          </button>
        </div>

        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <div key={day} className={`calendar-day-header ${index === 0 || index === 6 ? 'weekend-header' : ''}`}>
              {day}
            </div>
          ))}

          {calendarDays.map((date) => {
            const bookings = getBookingsForDate(date);
            const visibleBookings = bookings.slice(0, maxVisibleBars);
            const remainingCount = bookings.length - maxVisibleBars;
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isCurrentMonth = isSameMonth(date, currentDate);

            return (
              <div
                key={date.toISOString()}
                className={`calendar-day-cell ${isWeekend ? 'weekend' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
                onClick={() => {
                  if (bookings.length > 0) {
                    setSelectedDate(date);
                  }
                }}
                role={bookings.length > 0 ? 'button' : undefined}
                tabIndex={bookings.length > 0 ? 0 : undefined}
                onKeyDown={(e) => {
                  if (bookings.length > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setSelectedDate(date);
                  }
                }}
                aria-label={`${format(date, 'MMMM dd, yyyy')} - ${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`}
              >
                <div className="calendar-day-number">{format(date, 'd')}</div>
                {bookings.length > 0 && (
                  <div className="calendar-day-bookings">
                    {visibleBookings.map((booking) => (
                      <BookingBar
                        key={booking.id}
                        firstName={booking.user.firstName}
                        lastName={booking.user.lastName}
                        userId={booking.user.id}
                        type={booking.type}
                        compact={true}
                      />
                    ))}
                    {remainingCount > 0 && (
                      <div className="calendar-day-more" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(date);
                      }}>
                        +{remainingCount} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <DayBookingsModal
          date={selectedDate}
          bookings={selectedDayBookings.map((booking) => ({
            id: booking.id,
            firstName: booking.user.firstName,
            lastName: booking.user.lastName,
            userId: booking.user.id,
            type: booking.type,
            from: booking.from,
            to: booking.to,
            status: booking.status,
          }))}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}
/**
 * Utility functions for date calculations
 */

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Count working days between two dates (excluding weekends)
 * Note: Public holidays are not considered in this basic implementation
 */
export function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Get the date that is N working days from the given date
 */
export function addWorkingDays(date: Date, workingDays: number): Date {
  const result = new Date(date);
  let daysAdded = 0;
  
  while (daysAdded < workingDays) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      daysAdded++;
    }
  }
  
  return result;
}

/**
 * Check if user has completed trial period (3 months from hireDate)
 */
export function hasCompletedTrialPeriod(hireDate: Date | null): boolean {
  if (!hireDate) {
    return false; // If no hire date, consider trial not completed
  }
  
  const threeMonthsLater = new Date(hireDate);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return today >= threeMonthsLater;
}

/**
 * Calculate months since hire date (for accrual calculations)
 */
export function getMonthsSinceHire(hireDate: Date | null, endDate: Date = new Date()): number {
  if (!hireDate) {
    return 0;
  }
  
  const start = new Date(hireDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  const yearsDiff = end.getFullYear() - start.getFullYear();
  const monthsDiff = end.getMonth() - start.getMonth();
  
  return yearsDiff * 12 + monthsDiff;
}

/**
 * Get the start of the current year for accrual calculations
 */
export function getCurrentYearStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1); // January 1st of current year
}


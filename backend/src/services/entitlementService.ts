import { PrismaClient } from '@prisma/client';
import {
  countWorkingDays,
  hasCompletedTrialPeriod,
  getMonthsSinceHire,
  getCurrentYearStart,
  isWeekend,
} from '../utils/dateUtils.js';

const prisma = new PrismaClient();

/**
 * Vacation policy:
 * - 18 days per year
 * - 1.5 days per month (accrued on first day of month)
 * - 10 days can be carried over to next year, rest are eliminated
 * - Only working days counted
 */
const VACATION_DAYS_PER_YEAR = 18;
const VACATION_DAYS_PER_MONTH = 1.5;
const VACATION_CARRYOVER_MAX = 10;

/**
 * Sick Leave policy:
 * - 10 days per year
 * - 0.83 days per month (10/12)
 * - Accrued from beginning of new year
 */
const SICK_LEAVE_DAYS_PER_YEAR = 10;
const SICK_LEAVE_DAYS_PER_MONTH = 10 / 12; // ~0.83

interface EntitlementBreakdown {
  currentlyAllowed: number;
  futureAccrue: number;
  pendingForApproval: number;
  approved: number;
}

interface VacationEntitlement extends EntitlementBreakdown {
  type: 'vacation';
}

interface SickLeaveEntitlement extends EntitlementBreakdown {
  type: 'sick_leave';
}

interface DayOffEntitlement {
  type: 'day_off';
  currentlyAllowed: string; // "Unlimited"
}

interface WorkFromHomeEntitlement {
  type: 'work_from_home';
  currentlyAllowed: string; // "Unlimited"
}

type EntitlementDetails = VacationEntitlement | SickLeaveEntitlement | DayOffEntitlement | WorkFromHomeEntitlement;

/**
 * Calculate vacation entitlement for a user
 */
export async function calculateVacationEntitlement(
  userId: string,
  currentDate: Date = new Date()
): Promise<VacationEntitlement> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      entitlements: true,
    },
  });

  if (!user || !user.hireDate) {
    // If no hireDate, return 0 entitlement
    return {
      type: 'vacation',
      currentlyAllowed: 0,
      futureAccrue: VACATION_DAYS_PER_MONTH,
      pendingForApproval: 0,
      approved: 0,
    };
  }

  // Check if trial period is completed (3 months)
  const trialCompleted = hasCompletedTrialPeriod(user.hireDate);
  
  if (!trialCompleted) {
    return {
      type: 'vacation',
      currentlyAllowed: 0,
      futureAccrue: VACATION_DAYS_PER_MONTH,
      pendingForApproval: 0,
      approved: 0,
    };
  }

  const yearStart = getCurrentYearStart();
  const hireDate = new Date(user.hireDate);
  
  // Calculate months accrued this year
  // If hired before year start, count full year
  // If hired during year, count from hire month to current month
  const startMonth = hireDate >= yearStart ? hireDate.getMonth() : 0;
  const endMonth = currentDate.getMonth();
  
  // Calculate months including current month
  let monthsAccrued = 0;
  if (hireDate >= yearStart) {
    // Hired during current year - count from hire month
    monthsAccrued = endMonth - startMonth + 1; // +1 to include current month
  } else {
    // Hired before current year - full year accrual
    monthsAccrued = endMonth + 1; // +1 to include current month
  }

  // Get carried over days from previous year (max 10)
  const carriedOver = user.entitlements?.vacationDays || 0;
  const carriedOverDays = Math.min(carriedOver, VACATION_CARRYOVER_MAX);

  // Calculate total accrued this year
  const accruedThisYear = monthsAccrued * VACATION_DAYS_PER_MONTH;

  // Get approved vacation absences for current year (working days only)
  const approvedAbsences = await prisma.absence.findMany({
    where: {
      userId,
      type: 'vacation',
      status: 'approved',
      from: {
        gte: yearStart,
      },
    },
  });

  let approvedWorkingDays = 0;
  for (const absence of approvedAbsences) {
    approvedWorkingDays += countWorkingDays(new Date(absence.from), new Date(absence.to));
  }

  // Get pending vacation absences for current year (working days only)
  const pendingAbsences = await prisma.absence.findMany({
    where: {
      userId,
      type: 'vacation',
      status: 'pending',
      from: {
        gte: yearStart,
      },
    },
  });

  let pendingWorkingDays = 0;
  for (const absence of pendingAbsences) {
    pendingWorkingDays += countWorkingDays(new Date(absence.from), new Date(absence.to));
  }

  // Currently allowed = accrued + carried over - approved - pending
  const currentlyAllowed = Math.max(0, accruedThisYear + carriedOverDays - approvedWorkingDays - pendingWorkingDays);

  // Future accrue = next month's accrual (1.5 days)
  const futureAccrue = VACATION_DAYS_PER_MONTH;

  return {
    type: 'vacation',
    currentlyAllowed: Math.round(currentlyAllowed * 100) / 100, // Round to 2 decimals
    futureAccrue: Math.round(futureAccrue * 100) / 100,
    pendingForApproval: Math.round(pendingWorkingDays * 100) / 100,
    approved: Math.round(approvedWorkingDays * 100) / 100,
  };
}

/**
 * Calculate sick leave entitlement for a user
 */
export async function calculateSickLeaveEntitlement(
  userId: string,
  currentDate: Date = new Date()
): Promise<SickLeaveEntitlement> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.hireDate) {
    // If no hireDate, return 0 entitlement
    return {
      type: 'sick_leave',
      currentlyAllowed: 0,
      futureAccrue: SICK_LEAVE_DAYS_PER_MONTH,
      pendingForApproval: 0,
      approved: 0,
    };
  }

  const yearStart = getCurrentYearStart();
  const hireDate = new Date(user.hireDate);

  // Sick leave accrues from beginning of new year
  // If hired during the year, calculate from hire month
  const startMonth = hireDate >= yearStart ? hireDate.getMonth() : 0;
  const endMonth = currentDate.getMonth();
  const monthsAccrued = endMonth - startMonth + 1; // +1 to include current month

  // Calculate total accrued this year
  const accruedThisYear = monthsAccrued * SICK_LEAVE_DAYS_PER_MONTH;

  // Get approved sick leave absences for current year (working days only)
  const approvedAbsences = await prisma.absence.findMany({
    where: {
      userId,
      type: 'sick_leave',
      status: 'approved',
      from: {
        gte: yearStart,
      },
    },
  });

  let approvedWorkingDays = 0;
  for (const absence of approvedAbsences) {
    approvedWorkingDays += countWorkingDays(new Date(absence.from), new Date(absence.to));
  }

  // Get pending sick leave absences
  const pendingAbsences = await prisma.absence.findMany({
    where: {
      userId,
      type: 'sick_leave',
      status: 'pending',
      from: {
        gte: yearStart,
      },
    },
  });

  let pendingWorkingDays = 0;
  for (const absence of pendingAbsences) {
    pendingWorkingDays += countWorkingDays(new Date(absence.from), new Date(absence.to));
  }

  // Currently allowed = accrued - approved - pending
  const currentlyAllowed = Math.max(0, accruedThisYear - approvedWorkingDays - pendingWorkingDays);

  // Future accrue = next month's accrual
  const futureAccrue = SICK_LEAVE_DAYS_PER_MONTH;

  return {
    type: 'sick_leave',
    currentlyAllowed: Math.round(currentlyAllowed * 100) / 100,
    futureAccrue: Math.round(futureAccrue * 100) / 100,
    pendingForApproval: Math.round(pendingWorkingDays * 100) / 100,
    approved: Math.round(approvedWorkingDays * 100) / 100,
  };
}

/**
 * Get all entitlements breakdown for a user
 */
export async function getAllEntitlements(userId: string): Promise<EntitlementDetails[]> {
  const vacation = await calculateVacationEntitlement(userId);
  const sickLeave = await calculateSickLeaveEntitlement(userId);

  return [
    {
      type: 'day_off',
      currentlyAllowed: 'Unlimited',
    } as DayOffEntitlement,
    {
      type: 'work_from_home',
      currentlyAllowed: 'Unlimited',
    } as WorkFromHomeEntitlement,
    sickLeave,
    vacation,
  ];
}


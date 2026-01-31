import { PrismaClient } from '@prisma/client';
import {
  countWorkingDays,
  hasCompletedTrialPeriod,
  getCurrentYearStart,
  isWeekend,
} from '../utils/dateUtils.js';

const prisma = new PrismaClient();
const prismaAny = prisma as typeof prisma & { settings: any };

/**
 * Vacation policy:
 * - 18 days per year
 * - 1.5 days per month (accrued on first day of month)
 * - 10 days can be carried over to next year, rest are eliminated
 * - Only working days counted
 */
const VACATION_DAYS_PER_MONTH = 1.5;

/**
 * Sick Leave policy:
 * - 10 days per year
 * - Accrued from beginning of new year
 */
const SICK_LEAVE_DAYS_PER_MONTH = 10 / 12; // ~0.83

const SETTINGS_ID = 'global';

async function getSettings() {
  const settings = await prismaAny.settings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (settings) {
    return settings;
  }

  return prismaAny.settings.create({
    data: {
      id: SETTINGS_ID,
      vacationFutureAccrueDays: VACATION_DAYS_PER_MONTH,
      vacationCarryoverLimit: 0,
      sickLeaveWithoutCertificateLimit: 5,
      sickLeaveWithCertificateLimit: 5,
    },
  });
}

interface EntitlementBreakdown {
  currentlyAllowed: number;
  futureAccrue: number;
  pendingForApproval: number;
  approved: number;
}

interface VacationEntitlement extends EntitlementBreakdown {
  type: 'vacation';
  nextAccrueDate: string | null;
  nextAccrueAmount: number;
}

interface SickLeaveEntitlement extends EntitlementBreakdown {
  type: 'sick_leave';
  remainingWithCertificate: number;
  remainingWithoutCertificate: number;
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
  });

  if (!user || !user.hireDate) {
    // If no hireDate, return 0 entitlement
    const settings = await getSettings();
    return {
      type: 'vacation',
      currentlyAllowed: 0,
      futureAccrue: settings.vacationFutureAccrueDays,
      pendingForApproval: 0,
      approved: 0,
      nextAccrueDate: null,
      nextAccrueAmount: 0,
    };
  }

  // Check if trial period is completed (3 months)
  const trialCompleted = hasCompletedTrialPeriod(user.hireDate);
  
  if (!trialCompleted) {
    const settings = await getSettings();
    return {
      type: 'vacation',
      currentlyAllowed: 0,
      futureAccrue: settings.vacationFutureAccrueDays,
      pendingForApproval: 0,
      approved: 0,
      nextAccrueDate: null,
      nextAccrueAmount: 0,
    };
  }

  const yearStart = getCurrentYearStart();
  const hireDate = new Date(user.hireDate);
  
  // Calculate months accrued this year
  // If hired before year start, count full year
  // If hired during year, count from hire month to current month
  const startMonth = hireDate >= yearStart ? hireDate.getMonth() : 0;
  const endMonth = currentDate.getMonth();
  const hireDay = hireDate.getDate();
  
  // Calculate months including current month (accrual on 1st of month)
  let monthsAccrued = 0;
  if (hireDate >= yearStart) {
    if (endMonth >= startMonth) {
      monthsAccrued = endMonth - startMonth + 1;
      if (hireDay > 1) {
        monthsAccrued -= 1;
      }
    }
  } else {
    monthsAccrued = endMonth + 1; // +1 to include current month
  }

  monthsAccrued = Math.max(0, monthsAccrued);

  const carriedOverDays = await getPreviousYearCarryover(user, currentDate);

  // Calculate total accrued this year
  const accruedThisYear = monthsAccrued * VACATION_DAYS_PER_MONTH;

  // Get approved vacation absences for current year (working days only)
  const allVacationAbsences = await prisma.absence.findMany({
    where: {
      userId,
      type: 'vacation',
      status: {
        in: ['approved', 'pending'],
      },
      from: {
        gte: yearStart,
      },
    },
  });

  let approvedWorkingDays = 0;
  let pendingWorkingDays = 0;

  for (const absence of allVacationAbsences) {
    const days = countWorkingDays(new Date(absence.from), new Date(absence.to));
    if (absence.status === 'approved') {
      approvedWorkingDays += days;
    } else if (absence.status === 'pending') {
      pendingWorkingDays += days;
    }
  }

  // Currently allowed = accrued + carried over - approved - pending
  const currentlyAllowed = accruedThisYear + carriedOverDays - approvedWorkingDays - pendingWorkingDays;

  // Future accrue = next month's accrual (1.5 days)
  const settings = await getSettings();
  const monthlyAccrue = settings.vacationFutureAccrueDays;
  const nextAccrualDate = getNextVacationAccrualDate(currentDate, user.hireDate);
  const monthsRemaining = getRemainingAccrualMonths(currentDate, nextAccrualDate);
  const futureAccrue = monthsRemaining * monthlyAccrue;

  return {
    type: 'vacation',
    currentlyAllowed: Math.round(currentlyAllowed * 100) / 100, // Round to 2 decimals
    futureAccrue: Math.round(futureAccrue * 100) / 100,
    pendingForApproval: Math.round(pendingWorkingDays * 100) / 100,
    approved: Math.round(approvedWorkingDays * 100) / 100,
    nextAccrueDate: nextAccrualDate ? nextAccrualDate.toISOString() : null,
    nextAccrueAmount: Math.round(monthlyAccrue * 100) / 100,
  };
}

function getNextVacationAccrualDate(currentDate: Date, hireDate: Date): Date | null {
  const today = new Date(currentDate);
  const nextMonthAccrual = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const hireAccrualStart = new Date(
    hireDate.getFullYear(),
    hireDate.getMonth() + (hireDate.getDate() > 1 ? 1 : 0),
    1
  );

  if (nextMonthAccrual < hireAccrualStart) {
    return hireAccrualStart;
  }

  return nextMonthAccrual;
}

function getRemainingAccrualMonths(currentDate: Date, nextAccrualDate: Date | null): number {
  if (!nextAccrualDate) {
    return 0;
  }

  const currentYear = currentDate.getFullYear();
  if (nextAccrualDate.getFullYear() !== currentYear) {
    return 0;
  }

  return 12 - nextAccrualDate.getMonth();
}

function countWorkingDaysWithinRange(from: Date, to: Date, rangeStart: Date, rangeEnd: Date): number {
  const start = new Date(Math.max(from.getTime(), rangeStart.getTime()));
  const end = new Date(Math.min(to.getTime(), rangeEnd.getTime()));

  if (end < start) {
    return 0;
  }

  return countWorkingDays(start, end);
}

async function getPreviousYearCarryover(
  user: { id: string; hireDate: Date | null },
  currentDate: Date
): Promise<number> {
  if (!user.hireDate) {
    return 0;
  }

  const settings = await getSettings();

  const previousYear = currentDate.getFullYear() - 1;
  const previousYearStart = new Date(previousYear, 0, 1);
  const previousYearEnd = new Date(previousYear, 11, 31, 23, 59, 59, 999);
  const hireDate = new Date(user.hireDate);

  if (hireDate > previousYearEnd) {
    return 0;
  }

  const hireMonth = hireDate.getMonth();
  const hireDay = hireDate.getDate();
  const monthsAccrued =
    hireDate <= previousYearStart
      ? 12
      : Math.max(0, 12 - hireMonth - (hireDay > 1 ? 1 : 0));
  const accruedPreviousYear = monthsAccrued * VACATION_DAYS_PER_MONTH;

  const approvedAbsences = await prisma.absence.findMany({
    where: {
      userId: user.id,
      type: 'vacation',
      status: 'approved',
      from: {
        lte: previousYearEnd,
      },
      to: {
        gte: previousYearStart,
      },
    },
  });

  const pendingAbsences = await prisma.absence.findMany({
    where: {
      userId: user.id,
      type: 'vacation',
      status: 'pending',
      from: {
        lte: previousYearEnd,
      },
      to: {
        gte: previousYearStart,
      },
    },
  });

  let approvedWorkingDays = 0;
  for (const absence of approvedAbsences) {
    approvedWorkingDays += countWorkingDaysWithinRange(
      new Date(absence.from),
      new Date(absence.to),
      previousYearStart,
      previousYearEnd
    );
  }

  let pendingWorkingDays = 0;
  for (const absence of pendingAbsences) {
    pendingWorkingDays += countWorkingDaysWithinRange(
      new Date(absence.from),
      new Date(absence.to),
      previousYearStart,
      previousYearEnd
    );
  }

  const unused = accruedPreviousYear - approvedWorkingDays - pendingWorkingDays;
  if (unused <= 0) {
    return 0;
  }

  return Math.min(unused, settings.vacationCarryoverLimit);
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
    const settings = await getSettings();
    return {
      type: 'sick_leave',
      currentlyAllowed: 0,
      futureAccrue: 0,
      pendingForApproval: 0,
      approved: 0,
      remainingWithCertificate: settings.sickLeaveWithCertificateLimit,
      remainingWithoutCertificate: settings.sickLeaveWithoutCertificateLimit,
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

  const sickLeaveAbsences = (await prisma.absence.findMany({
    where: {
      userId,
      type: 'sick_leave',
      status: {
        in: ['approved', 'pending'],
      },
      from: {
        gte: yearStart,
      },
    },
    include: {
      files: {
        select: {
          id: true,
        },
      },
    },
  } as any)) as unknown as Array<{
    from: Date;
    to: Date;
    status: 'approved' | 'pending';
    files: Array<{ id: string }>;
  }>;

  let approvedWorkingDays = 0;
  let pendingWorkingDays = 0;
  let usedWithCertificate = 0;
  let usedWithoutCertificate = 0;
  for (const absence of sickLeaveAbsences) {
    const days = countWorkingDays(new Date(absence.from), new Date(absence.to));
    const hasCertificate = absence.files.length > 0;
    if (absence.status === 'approved') {
      approvedWorkingDays += days;
    } else {
      pendingWorkingDays += days;
    }

    if (hasCertificate) {
      usedWithCertificate += days;
    } else {
      usedWithoutCertificate += days;
    }
  }

  // Currently allowed = accrued - approved - pending
  const currentlyAllowed = Math.max(0, accruedThisYear - approvedWorkingDays - pendingWorkingDays);

  const futureAccrue = 0;
  const settings = await getSettings();
  const remainingWithCertificate = Math.max(
    0,
    settings.sickLeaveWithCertificateLimit - usedWithCertificate
  );
  const remainingWithoutCertificate = Math.max(
    0,
    settings.sickLeaveWithoutCertificateLimit - usedWithoutCertificate
  );

  return {
    type: 'sick_leave',
    currentlyAllowed: Math.round(currentlyAllowed * 100) / 100,
    futureAccrue: Math.round(futureAccrue * 100) / 100,
    pendingForApproval: Math.round(pendingWorkingDays * 100) / 100,
    approved: Math.round(approvedWorkingDays * 100) / 100,
    remainingWithCertificate: Math.round(remainingWithCertificate * 100) / 100,
    remainingWithoutCertificate: Math.round(remainingWithoutCertificate * 100) / 100,
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


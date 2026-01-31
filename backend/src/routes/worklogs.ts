import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { countWorkingDays } from '../utils/dateUtils.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

interface WorkLogWithRelations {
  id: string;
  userId: string;
  date: Date;
  start: Date;
  end: Date;
  projectId: string | null;
  note: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  } | null;
}

interface SettingsData {
  vacationCarryoverLimit: number;
  sickLeaveWithoutCertificateLimit: number;
  sickLeaveWithCertificateLimit: number;
}

const SETTINGS_ID = 'global';

async function getSettings(): Promise<SettingsData> {
  const settings = await (prisma as any).settings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (settings) {
    return settings as SettingsData;
  }

  return (prisma as any).settings.create({
    data: {
      id: SETTINGS_ID,
      vacationFutureAccrueDays: 1.5,
      vacationCarryoverLimit: 0,
      sickLeaveWithoutCertificateLimit: 5,
      sickLeaveWithCertificateLimit: 5,
    },
  }) as SettingsData;
}

function countWorkingDaysWithinRange(
  from: Date,
  to: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const start = new Date(Math.max(from.getTime(), rangeStart.getTime()));
  const end = new Date(Math.min(to.getTime(), rangeEnd.getTime()));

  if (end < start) {
    return 0;
  }

  return countWorkingDays(start, end);
}

const createWorkLogSchema = z
  .object({
    date: z.string().datetime(),
    start: z.string().datetime(),
    end: z.string().datetime(),
    projectId: z.string().uuid().optional(),
    note: z.string().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.start);
      const end = new Date(data.end);
      return end > start;
    },
    {
      message: 'End time must be after start time',
      path: ['end'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.start);
      const end = new Date(data.end);
      const totalMs = end.getTime() - start.getTime();
      const totalHours = totalMs / (1000 * 60 * 60);
      return totalHours <= 16;
    },
    {
      message: 'Total worked hours cannot exceed 16 hours per day',
      path: ['end'],
    }
  )

const updateWorkLogSchema = z.object({
  date: z.string().datetime().optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  projectId: z.string().uuid().optional(),
  note: z.string().optional(),
});

// Create work log
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req;
    const data = createWorkLogSchema.parse(req.body);

    const logDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    logDate.setHours(0, 0, 0, 0);
    const isPastDue = logDate < today;

    const workLog = await prisma.workLog.create({
      data: {
        userId: userId!,
        date: new Date(data.date),
        start: new Date(data.start),
        end: new Date(data.end),
        projectId: data.projectId || null,
        note: data.note || null,
        isPastDue: isPastDue,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(workLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        const field = err.path.join('.');
        return `${field ? `${field}: ` : ''}${err.message}`;
      });
      return res.status(400).json({
        error: errorMessages.join('. ') || 'Validation failed',
        details: error.errors,
      });
    }
    console.error('Error creating work log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's work logs
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req;
    const { month } = req.query;

    let where: any = { userId };

    if (month) {
      // month format: YYYY-MM
      const [year, monthNum] = (month as string).split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    const workLogs = await prisma.workLog.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(workLogs);
  } catch (error) {
    console.error('Error fetching work logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all work logs (admin only)
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { month, userId, projectId } = req.query;

    let where: any = {};

    if (month) {
      const [year, monthNum] = (month as string).split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (projectId) {
      where.projectId = projectId as string;
    }

    const workLogs = await prisma.workLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(workLogs);
  } catch (error) {
    console.error('Error fetching work logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin report with summary
router.get('/report', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { month, userId, projectId } = req.query;

    let where: any = {};

    if (month) {
      const [year, monthNum] = (month as string).split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (projectId) {
      where.projectId = projectId as string;
    }

    const workLogs = await prisma.workLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate summary per user
    const summary: Record<
      string,
      {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        totalHours: number;
        totalDays: number;
        overtime: number;
      sickLeaveHours: number;
      vacationHours: number;
      }
    > = {};

    workLogs.forEach((log: WorkLogWithRelations) => {
      if (!log.user) return; // Skip if user data is missing
      
      const start = new Date(log.start);
      const end = new Date(log.end);
      const totalMs = end.getTime() - start.getTime();
      const totalHours = totalMs / (1000 * 60 * 60);

      if (!summary[log.userId]) {
        summary[log.userId] = {
          userId: log.userId,
          firstName: log.user.firstName,
          lastName: log.user.lastName,
          email: log.user.email,
          totalHours: 0,
          totalDays: 0,
          overtime: 0,
        sickLeaveHours: 0,
        vacationHours: 0,
        };
      }

      summary[log.userId].totalHours += totalHours;
      summary[log.userId].totalDays += 1;

      // Overtime: hours over 8 per day
      const regularHours = Math.min(totalHours, 8);
      const overtime = Math.max(0, totalHours - regularHours);
      summary[log.userId].overtime += overtime;
    });

  const userIds = Object.keys(summary);
  if (userIds.length > 0) {
    const settings = await getSettings();
    const sickLeaveLimit =
      settings.sickLeaveWithoutCertificateLimit + settings.sickLeaveWithCertificateLimit;
    const vacationLimit = 18 + settings.vacationCarryoverLimit;

    const reportYear = month
      ? Number((month as string).split('-')[0])
      : new Date().getFullYear();
    const monthStart = month
      ? new Date(reportYear, Number((month as string).split('-')[1]) - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthEnd = month
      ? new Date(reportYear, Number((month as string).split('-')[1]), 0, 23, 59, 59, 999)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    const yearStart = new Date(reportYear, 0, 1);
    const yearEnd = new Date(reportYear, 11, 31, 23, 59, 59, 999);
    const beforeMonthEnd = new Date(monthStart);
    beforeMonthEnd.setDate(beforeMonthEnd.getDate() - 1);
    beforeMonthEnd.setHours(23, 59, 59, 999);

    const absences = await prisma.absence.findMany({
      where: {
        userId: { in: userIds },
        status: 'approved',
        type: {
          in: ['sick_leave', 'vacation'],
        },
        from: {
          lte: yearEnd,
        },
        to: {
          gte: yearStart,
        },
      },
      select: {
        userId: true,
        type: true,
        from: true,
        to: true,
      },
    });

    const usedBefore: Record<string, { sick_leave: number; vacation: number }> = {};
    const usedInMonth: Record<string, { sick_leave: number; vacation: number }> = {};

    for (const absence of absences) {
      if (!usedBefore[absence.userId]) {
        usedBefore[absence.userId] = { sick_leave: 0, vacation: 0 };
        usedInMonth[absence.userId] = { sick_leave: 0, vacation: 0 };
      }

      const daysBefore =
        beforeMonthEnd >= yearStart
          ? countWorkingDaysWithinRange(
              new Date(absence.from),
              new Date(absence.to),
              yearStart,
              beforeMonthEnd
            )
          : 0;
      const daysInMonth = countWorkingDaysWithinRange(
        new Date(absence.from),
        new Date(absence.to),
        monthStart,
        monthEnd
      );

      usedBefore[absence.userId][absence.type] += daysBefore;
      usedInMonth[absence.userId][absence.type] += daysInMonth;
    }

    for (const userIdKey of userIds) {
      const before = usedBefore[userIdKey] || { sick_leave: 0, vacation: 0 };
      const inMonth = usedInMonth[userIdKey] || { sick_leave: 0, vacation: 0 };

      const sickLeaveRemaining = Math.max(0, sickLeaveLimit - before.sick_leave);
      const vacationRemaining = Math.max(0, vacationLimit - before.vacation);

      const sickLeaveCountedDays = Math.min(inMonth.sick_leave, sickLeaveRemaining);
      const vacationCountedDays = Math.min(inMonth.vacation, vacationRemaining);

      summary[userIdKey].sickLeaveHours = sickLeaveCountedDays * 8;
      summary[userIdKey].vacationHours = vacationCountedDays * 8;
    }
  }

    res.json({
      workLogs,
      summary: Object.values(summary),
    });
  } catch (error) {
    console.error('Error fetching work log report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update work log
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;
    const data = updateWorkLogSchema.parse(req.body);

    // Check if work log exists and user has permission
    const existingLog = await prisma.workLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      return res.status(404).json({ error: 'Work log not found' });
    }

    // Employees can only edit their own logs in current month
    if (!isAdmin && existingLog.userId !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (!isAdmin) {
      const logDate = new Date(existingLog.date);
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const logMonth = new Date(logDate.getFullYear(), logDate.getMonth(), 1);

      if (logMonth.getTime() !== currentMonth.getTime()) {
        return res.status(403).json({ error: 'You can only edit logs from the current month' });
      }
    }

    const updateData: any = {};
    if (data.date) {
      const logDate = new Date(data.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      logDate.setHours(0, 0, 0, 0);
      updateData.date = new Date(data.date);
      updateData.isPastDue = logDate < today;
    }
    if (data.start) updateData.start = new Date(data.start);
    if (data.end) updateData.end = new Date(data.end);
    if (data.projectId !== undefined) updateData.projectId = data.projectId || null;
    if (data.note !== undefined) updateData.note = data.note || null;

    const workLog = await prisma.workLog.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(workLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        const field = err.path.join('.');
        return `${field ? `${field}: ` : ''}${err.message}`;
      });
      return res.status(400).json({
        error: errorMessages.join('. ') || 'Validation failed',
        details: error.errors,
      });
    }
    console.error('Error updating work log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete work log
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    // Check if work log exists and user has permission
    const existingLog = await prisma.workLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      return res.status(404).json({ error: 'Work log not found' });
    }

    // Employees can only delete their own logs in current month
    if (!isAdmin && existingLog.userId !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (!isAdmin) {
      const logDate = new Date(existingLog.date);
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const logMonth = new Date(logDate.getFullYear(), logDate.getMonth(), 1);

      if (logMonth.getTime() !== currentMonth.getTime()) {
        return res.status(403).json({ error: 'You can only delete logs from the current month' });
      }
    }

    await prisma.workLog.delete({
      where: { id },
    });

    res.json({ message: 'Work log deleted successfully' });
  } catch (error) {
    console.error('Error deleting work log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

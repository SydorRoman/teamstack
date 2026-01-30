import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { countWorkingDays, hasCompletedTrialPeriod, addWorkingDays } from '../utils/dateUtils.js';

const router = express.Router();
const prisma = new PrismaClient();

const createAbsenceSchema = z
  .object({
    type: z.enum(['sick_leave', 'day_off', 'vacation', 'work_from_home']),
    from: z.string().datetime({ message: 'Start date is required and must be a valid date' }),
    to: z.string().datetime({ message: 'End date is required and must be a valid date' }),
  })
  .refine(
    (data) => {
      const from = new Date(data.from);
      const to = new Date(data.to);
      return to >= from;
    },
    {
      message: 'End date must be equal to or after start date',
      path: ['to'],
    }
  )
  .refine(
    (data) => {
      const from = new Date(data.from);
      const to = new Date(data.to);
      const diffTime = Math.abs(to.getTime() - from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
      return diffDays <= 30;
    },
    {
      message: 'The maximum range between start date and end date is 30 days',
      path: ['to'],
    }
  );

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, isAdmin } = req;
    const { showAll, projectId, search, startDate, endDate } = req.query;
    const projectIdsRaw = req.query.projectIds ?? projectId;
    const userIdsRaw = req.query.userIds ?? search;
    const projectIds = Array.isArray(projectIdsRaw)
      ? (projectIdsRaw as string[])
      : typeof projectIdsRaw === 'string'
      ? [projectIdsRaw]
      : [];
    const userIds = Array.isArray(userIdsRaw)
      ? (userIdsRaw as string[])
      : typeof userIdsRaw === 'string'
      ? [userIdsRaw]
      : [];

    let where: any = {};

    // If not showing all, show only current user's absences
    if (showAll !== 'true' && userIds.length === 0 && !search) {
      where.userId = userId;
    }

    // Build user filter conditions
    const userConditions: any[] = [];

    if (projectIds.length > 0) {
      userConditions.push({
        projects: {
          some: {
            id: {
              in: projectIds,
            },
          },
        },
      });
    }

    if (userIds.length > 0) {
      userConditions.push({
        id: {
          in: userIds,
        },
      });
    } else if (search) {
      userConditions.push({
        OR: [{ id: { equals: search as string } }],
      });
    }

    // If we have user conditions, combine them
    if (userConditions.length > 0) {
      where.user = userConditions.length === 1 ? userConditions[0] : { AND: userConditions };
    }

    if (startDate && endDate) {
      // Show all absences that overlap with the date range
      // An absence overlaps if: from <= endDate AND to >= startDate
      where.AND = [
        ...(where.AND || []),
        {
          from: {
            lte: new Date(endDate as string),
          },
        },
        {
          to: {
            gte: new Date(startDate as string),
          },
        },
      ];
    }

    const absences = await prisma.absence.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            projects: true,
          },
        },
      },
      orderBy: {
        from: 'asc',
      },
    });

    res.json(absences);
  } catch (error) {
    console.error('Error fetching absences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req;
    const data = createAbsenceSchema.parse(req.body);

    // For vacation requests, add additional validations
    if (data.type === 'vacation') {
      const user = await prisma.user.findUnique({
        where: { id: userId! },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check trial period (3 months)
      if (!user.hireDate || !hasCompletedTrialPeriod(user.hireDate)) {
        return res.status(400).json({
          error: 'Vacation requests are only available after completing the trial period (3 months). Please contact admin to set your hire date.',
        });
      }

      // Check 10 working days notice requirement
      const vacationStart = new Date(data.from);
      vacationStart.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate 10 working days from today
      const requiredDate = addWorkingDays(today, 10);
      
      if (vacationStart < requiredDate) {
        const workingDaysUntilStart = countWorkingDays(today, vacationStart);
        return res.status(400).json({
          error: `Vacation request must be created at least 10 working days before the start date. You have ${workingDaysUntilStart} working days until ${vacationStart.toLocaleDateString()}`,
        });
      }
    }

    const absence = await prisma.absence.create({
      data: {
        userId: userId!,
        type: data.type,
        from: new Date(data.from),
        to: new Date(data.to),
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
      },
    });

    res.status(201).json(absence);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors for better user experience
      const errorMessages = error.errors.map((err) => {
        const field = err.path.join('.');
        return `${field ? `${field}: ` : ''}${err.message}`;
      });
      return res.status(400).json({ 
        error: errorMessages.join('. ') || 'Validation failed',
        details: error.errors 
      });
    }
    console.error('Error creating absence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { countWorkingDays, hasCompletedTrialPeriod, addWorkingDays } from '../utils/dateUtils.js';
import { LocalStorageService } from '../services/storage/localStorageService.js';

const router = express.Router();
const prisma = new PrismaClient();
const prismaAny = prisma as typeof prisma & { settings: any; absence: any; absenceFile: any };

const upload = multer({ storage: multer.memoryStorage() });
const storageService = new LocalStorageService(path.resolve(process.cwd(), 'uploads', 'sick-leave'));
const SETTINGS_ID = 'global';
const DAY_MS = 24 * 60 * 60 * 1000;

const handleUploadIfMultipart: express.RequestHandler = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.array('files')(req, res, next);
  }
  return next();
};

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function endOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function countCalendarDays(from: Date, to: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const diffDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return diffDays + 1;
}

function countDaysWithinRange(from: Date, to: Date, rangeStart: Date, rangeEnd: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const effectiveStart = startOfDay(new Date(Math.max(start.getTime(), rangeStart.getTime())));
  const effectiveEnd = startOfDay(new Date(Math.min(end.getTime(), rangeEnd.getTime())));

  if (effectiveEnd < effectiveStart) {
    return 0;
  }

  const diffDays = Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / DAY_MS);
  return diffDays + 1;
}

function getYearBounds(date: Date): { yearStart: Date; yearEnd: Date } {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const yearEnd = new Date(date.getFullYear(), 11, 31);
  yearEnd.setHours(23, 59, 59, 999);
  return { yearStart, yearEnd };
}

async function getSettingsWithDefaults() {
  const settings = await prismaAny.settings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (settings) {
    return settings;
  }

  return prismaAny.settings.create({
    data: {
      id: SETTINGS_ID,
      vacationFutureAccrueDays: 1.5,
      sickLeaveWithoutCertificateLimit: 5,
      sickLeaveWithCertificateLimit: 5,
      vacationCarryoverLimit: 0,
    },
  });
}

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

    const absences = await prismaAny.absence.findMany({
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
        files: true,
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

router.post('/', authenticateToken, handleUploadIfMultipart, async (req: AuthRequest, res) => {
  try {
    const { userId } = req;
    const data = createAbsenceSchema.parse({
      type: req.body.type,
      from: req.body.from,
      to: req.body.to,
    });
    const files = Array.isArray(req.files) ? req.files : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const absenceStart = startOfDay(new Date(data.from));
    const absenceEnd = startOfDay(new Date(data.to));
    const totalDays = countCalendarDays(absenceStart, absenceEnd);

    // Allow backdated absences up to 14 calendar days in the past
    // TODO: Uncomment this when we have a way to allow backdated absence
    // const backdatedDays = Math.floor((today.getTime() - absenceStart.getTime()) / (1000 * 60 * 60 * 24));
    // if (absenceStart < today && backdatedDays > 14) {
    //   return res.status(400).json({
    //     error: 'Backdated absences can only be created up to 14 days in the past.',
    //   });
    // }

    if (data.type !== 'sick_leave' && files.length > 0) {
      return res.status(400).json({
        error: 'Files can only be uploaded for Sick Leave absences.',
      });
    }

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
      // Only enforce for future dates; backdated vacations are allowed
      // TODO: Uncomment this when we have a way to allow backdated vacation
      // if (absenceStart >= today) {
      //   // Calculate 10 working days from today
      //   const requiredDate = addWorkingDays(today, 10);
        
      //   if (absenceStart < requiredDate) {
      //     const workingDaysUntilStart = countWorkingDays(today, absenceStart);
      //     return res.status(400).json({
      //       error: `Vacation request must be created at least 10 working days before the start date. You have ${workingDaysUntilStart} working days until ${absenceStart.toLocaleDateString()}`,
      //     });
      //   }
      // }
    }

    if (data.type === 'sick_leave') {
      const hasNewFiles = files.length > 0;
      const isSingleDay = totalDays === 1;
      const prevDay = startOfDay(new Date(absenceStart.getTime() - DAY_MS));
      const nextDay = startOfDay(new Date(absenceEnd.getTime() + DAY_MS));

      if (!isSingleDay && !hasNewFiles) {
        return res.status(400).json({
          error: 'Sick Leave for 2 or more consecutive days requires a certificate.',
        });
      }

      const adjacentAbsences = await prismaAny.absence.findMany({
        where: {
          userId: userId!,
          type: 'sick_leave',
          status: {
            not: 'rejected',
          },
          OR: [
            {
              from: {
                lte: endOfDay(prevDay),
              },
              to: {
                gte: startOfDay(prevDay),
              },
            },
            {
              from: {
                lte: endOfDay(nextDay),
              },
              to: {
                gte: startOfDay(nextDay),
              },
            },
          ],
        },
        include: {
          files: true,
        },
      });

      const hasAdjacent = adjacentAbsences.length > 0;
      const adjacentHasCertificate = adjacentAbsences.some(
        (absence: { files: unknown[] }) => absence.files.length > 0
      );

      if (isSingleDay && hasAdjacent && !hasNewFiles && !adjacentHasCertificate) {
        return res.status(400).json({
          error: 'Consecutive Sick Leave days require a certificate. Please attach a file.',
        });
      }

      const { yearStart, yearEnd } = getYearBounds(absenceStart);
      const unconfirmedCount = await prismaAny.absence.count({
        where: {
          userId: userId!,
          type: 'sick_leave',
          status: {
            not: 'rejected',
          },
          from: {
            lte: yearEnd,
          },
          to: {
            gte: yearStart,
          },
          files: {
            none: {},
          },
        },
      });

      if (isSingleDay && !hasNewFiles && unconfirmedCount > 0) {
        return res.status(400).json({
          error: 'You already have Sick Leave days without a certificate. Please attach a file.',
        });
      }

      const settings = await getSettingsWithDefaults();
      const yearsToCheck = Array.from(new Set([absenceStart.getFullYear(), absenceEnd.getFullYear()]));

      for (const year of yearsToCheck) {
        const rangeStart = new Date(year, 0, 1);
        const rangeEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        const absences = await prismaAny.absence.findMany({
          where: {
            userId: userId!,
            type: 'sick_leave',
            status: {
              not: 'rejected',
            },
            from: {
              lte: rangeEnd,
            },
            to: {
              gte: rangeStart,
            },
          },
          include: {
            files: true,
          },
        });

        let usedWithCertificate = 0;
        let usedWithoutCertificate = 0;

        for (const absence of absences) {
          const daysInYear = countDaysWithinRange(
            new Date(absence.from),
            new Date(absence.to),
            rangeStart,
            rangeEnd
          );

          if (daysInYear === 0) {
            continue;
          }

          if (absence.files.length > 0) {
            usedWithCertificate += daysInYear;
          } else {
            usedWithoutCertificate += daysInYear;
          }
        }

        const newDays = countDaysWithinRange(absenceStart, absenceEnd, rangeStart, rangeEnd);

        if (newDays > 0) {
          if (!hasNewFiles) {
            if (usedWithoutCertificate + newDays > settings.sickLeaveWithoutCertificateLimit) {
              return res.status(400).json({
                error: `Sick Leave without certificate exceeds the annual limit of ${settings.sickLeaveWithoutCertificateLimit} days.`,
              });
            }
          } else if (usedWithCertificate + newDays > settings.sickLeaveWithCertificateLimit) {
            return res.status(400).json({
              error: `Sick Leave with certificate exceeds the annual limit of ${settings.sickLeaveWithCertificateLimit} days.`,
            });
          }
        }
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

    if (data.type === 'sick_leave' && files.length > 0) {
      const storedFiles = [];

      try {
        for (const file of files) {
          const stored = await storageService.saveFile(
            file,
            `${userId!}/${absence.id}`
          );
          storedFiles.push({
            absenceId: absence.id,
            fileName: stored.fileName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            storagePath: stored.storagePath,
          });
        }

        await prismaAny.absenceFile.createMany({
          data: storedFiles,
        });
      } catch (error) {
        await prisma.absence.delete({
          where: { id: absence.id },
        });

        return res.status(500).json({
          error: 'Failed to store uploaded files. Please try again.',
        });
      }
    }

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

router.post('/:id/files', authenticateToken, handleUploadIfMultipart, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;
    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'Please attach at least one file.' });
    }

    const absence = await prisma.absence.findUnique({
      where: { id },
    });

    if (!absence) {
      return res.status(404).json({ error: 'Absence not found' });
    }

    if (!isAdmin && absence.userId !== userId) {
      return res.status(403).json({ error: 'You are not allowed to update this absence.' });
    }

    if (absence.type !== 'sick_leave') {
      return res.status(400).json({ error: 'Files can only be uploaded for Sick Leave absences.' });
    }

    const storedFiles = [];

    try {
      for (const file of files) {
        const stored = await storageService.saveFile(file, `${absence.userId}/${absence.id}`);
        storedFiles.push({
          absenceId: absence.id,
          fileName: stored.fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storagePath: stored.storagePath,
        });
      }

      await prismaAny.absenceFile.createMany({
        data: storedFiles,
      });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to store uploaded files. Please try again.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const absenceEnd = new Date(absence.to);
    absenceEnd.setHours(23, 59, 59, 999);

    let updatedAbsence = absence;
    if (absenceEnd < today && absence.status !== 'pending') {
      updatedAbsence = await prisma.absence.update({
        where: { id: absence.id },
        data: { status: 'pending' },
      });
    }

    return res.json(updatedAbsence);
  } catch (error) {
    console.error('Error uploading absence files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/files/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    const fileRecord = await prismaAny.absenceFile.findUnique({
      where: { id },
      include: {
        absence: true,
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!isAdmin && fileRecord.absence.userId !== userId) {
      return res.status(403).json({ error: 'You are not allowed to access this file.' });
    }

    const absolutePath = path.resolve(
      process.cwd(),
      'uploads',
      'sick-leave',
      ...fileRecord.storagePath.split('/')
    );

    return res.download(absolutePath, fileRecord.originalName);
  } catch (error) {
    console.error('Error downloading absence file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/files/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    const fileRecord = await prismaAny.absenceFile.findUnique({
      where: { id },
      include: {
        absence: true,
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!isAdmin && fileRecord.absence.userId !== userId) {
      return res.status(403).json({ error: 'You are not allowed to delete this file.' });
    }

    if (fileRecord.absence.status === 'approved') {
      return res.status(400).json({ error: 'Cannot delete files from approved absences.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const absenceStart = new Date(fileRecord.absence.from);
    absenceStart.setHours(0, 0, 0, 0);

    if (absenceStart < today) {
      return res.status(400).json({ error: 'Cannot delete files for past absences.' });
    }

    const absolutePath = path.resolve(
      process.cwd(),
      'uploads',
      'sick-leave',
      ...fileRecord.storagePath.split('/')
    );

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      // Ignore file not found errors; we still remove DB record.
    }

    await prismaAny.absenceFile.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting absence file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/files/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    const fileRecord = await prismaAny.absenceFile.findUnique({
      where: { id },
      include: {
        absence: true,
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!isAdmin && fileRecord.absence.userId !== userId) {
      return res.status(403).json({ error: 'You are not allowed to delete this file.' });
    }

    if (fileRecord.absence.type !== 'sick_leave') {
      return res.status(400).json({ error: 'Files can only be removed for Sick Leave absences.' });
    }

    const today = startOfDay(new Date());
    const absenceEnd = startOfDay(new Date(fileRecord.absence.to));

    if (fileRecord.absence.status === 'approved' || absenceEnd < today) {
      return res.status(400).json({
        error: 'Files can only be removed for non-approved absences starting today or later.',
      });
    }

    const absolutePath = path.resolve(
      process.cwd(),
      'uploads',
      'sick-leave',
      ...fileRecord.storagePath.split('/')
    );

    try {
      await fs.unlink(absolutePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.error('Error deleting absence file from disk:', error);
      }
    }

    await prismaAny.absenceFile.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting absence file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

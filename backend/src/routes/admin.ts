import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();
const prismaAny = prisma as typeof prisma & { settings: any; settingsChangeLog: any };

router.use(authenticateToken);

// Projects endpoint - available for both admin and regular users
router.get('/projects', async (req: AuthRequest, res) => {
  try {
    const { userId, isAdmin } = req;

    if (isAdmin) {
      // Admin sees all projects
      const projects = await prisma.project.findMany({
        orderBy: {
          name: 'asc',
        },
      });
      res.json(projects);
    } else {
      // User sees only their projects
      const user = await prisma.user.findUnique({
        where: { id: userId! },
        include: {
          projects: {
            orderBy: {
              name: 'asc',
            },
          },
        },
      });

      res.json(user?.projects || []);
    }
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All other routes require admin access
router.use(requireAdmin);

const SETTINGS_ID = 'global';

const updateSettingsSchema = z.object({
  vacationFutureAccrueDays: z.number().min(0),
  sickLeaveWithoutCertificateLimit: z.number().int().min(0),
  sickLeaveWithCertificateLimit: z.number().int().min(0),
  vacationCarryoverLimit: z.number().int().min(0),
});

const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  birthDate: z
    .string()
    .datetime()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  hireDate: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        return dateRegex.test(val) || datetimeRegex.test(val);
      },
      { message: 'Invalid date format. Use YYYY-MM-DD or ISO datetime' }
    )
    .or(z.literal('').transform(() => undefined)),
  positionId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  gender: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isAdmin: z.boolean().default(false),
  projectIds: z.array(z.string()).optional(),
});

router.get('/pending-requests-count', async (req, res) => {
  try {
    const count = await prisma.absence.count({
      where: {
        status: 'pending',
      },
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching pending requests count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending-requests', async (req, res) => {
  try {
    const absences = await prisma.absence.findMany({
      where: {
        status: 'pending',
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const response = absences.map((absence) => ({
      ...absence,
      isBackdated: new Date(absence.from).setHours(0, 0, 0, 0) < today.getTime(),
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await prismaAny.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      const created = await prismaAny.settings.create({
        data: {
          id: SETTINGS_ID,
          vacationFutureAccrueDays: 1.5,
          sickLeaveWithoutCertificateLimit: 5,
          sickLeaveWithCertificateLimit: 5,
          vacationCarryoverLimit: 0,
        },
      });
      return res.json(created);
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/settings/logs', async (req, res) => {
  try {
    const logs = await prismaAny.settingsChangeLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching settings change logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const { userId } = req;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const data = updateSettingsSchema.parse(req.body);

    const admin = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!admin) {
      return res.status(400).json({ error: 'Admin user not found. Please log in again.' });
    }

    const existing = await prismaAny.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

    const settings = await prismaAny.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        vacationFutureAccrueDays: data.vacationFutureAccrueDays,
        sickLeaveWithoutCertificateLimit: data.sickLeaveWithoutCertificateLimit,
        sickLeaveWithCertificateLimit: data.sickLeaveWithCertificateLimit,
        vacationCarryoverLimit: data.vacationCarryoverLimit,
      },
      create: {
        id: SETTINGS_ID,
        vacationFutureAccrueDays: data.vacationFutureAccrueDays,
        sickLeaveWithoutCertificateLimit: data.sickLeaveWithoutCertificateLimit,
        sickLeaveWithCertificateLimit: data.sickLeaveWithCertificateLimit,
        vacationCarryoverLimit: data.vacationCarryoverLimit,
      },
    });

    const previousVacationFutureAccrue =
      existing?.vacationFutureAccrueDays ?? settings.vacationFutureAccrueDays;
    const previousSickLeaveWithoutCertificateLimit =
      existing?.sickLeaveWithoutCertificateLimit ?? settings.sickLeaveWithoutCertificateLimit;
    const previousSickLeaveWithCertificateLimit =
      existing?.sickLeaveWithCertificateLimit ?? settings.sickLeaveWithCertificateLimit;
    const previousVacationCarryoverLimit =
      existing?.vacationCarryoverLimit ?? settings.vacationCarryoverLimit;

    const changesDetected =
      previousVacationFutureAccrue !== settings.vacationFutureAccrueDays ||
      previousSickLeaveWithoutCertificateLimit !== settings.sickLeaveWithoutCertificateLimit ||
      previousSickLeaveWithCertificateLimit !== settings.sickLeaveWithCertificateLimit ||
      previousVacationCarryoverLimit !== settings.vacationCarryoverLimit;

    if (changesDetected) {
      await prismaAny.settingsChangeLog.create({
        data: {
          settingsId: settings.id,
          adminId: admin.id,
          previousVacationFutureAccrue,
          newVacationFutureAccrue: settings.vacationFutureAccrueDays,
          previousSickLeaveWithoutCertificateLimit,
          newSickLeaveWithoutCertificateLimit: settings.sickLeaveWithoutCertificateLimit,
          previousSickLeaveWithCertificateLimit,
          newSickLeaveWithCertificateLimit: settings.sickLeaveWithCertificateLimit,
          previousVacationCarryoverLimit,
          newVacationCarryoverLimit: settings.vacationCarryoverLimit,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const absence = await prisma.absence.update({
      where: { id },
      data: { status: 'approved' },
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

    res.json(absence);
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const absence = await prisma.absence.update({
      where: { id },
      data: { status: 'rejected' },
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

    res.json(absence);
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        telegram: true,
        birthDate: true,
        hireDate: true,
        positionId: true,
        position: {
          select: {
            id: true,
            name: true,
          },
        },
        gender: true,
        city: true,
        country: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        lastName: 'asc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    const { projectIds, password, ...userData } = data;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        birthDate: data.birthDate && data.birthDate.trim() !== ''
          ? (() => {
              // Parse date string as UTC midnight to avoid timezone issues
              const dateStr = data.birthDate.includes('T')
                ? data.birthDate.split('T')[0]
                : data.birthDate;
              const [year, month, day] = dateStr.split('-').map(Number);
              // Create date in UTC midnight to ensure correct storage
              return new Date(Date.UTC(year, month - 1, day));
            })()
          : null,
        hireDate: data.hireDate && data.hireDate.trim() !== ''
          ? (() => {
              const dateStr = data.hireDate.includes('T')
                ? data.hireDate.split('T')[0]
                : data.hireDate;
              const [year, month, day] = dateStr.split('-').map(Number);
              return new Date(Date.UTC(year, month - 1, day));
            })()
          : null,
        positionId: data.positionId || null,
        projects: projectIds
          ? {
              connect: projectIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        projects: true,
        position: true,
      },
    });

    // Create default entitlements
    await prisma.entitlement.create({
      data: {
        userId: user.id,
        vacationDays: 20,
        sickLeaveDays: 10,
        dayOffDays: 5,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  birthDate: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        // Accept both date (YYYY-MM-DD) and datetime formats
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        return dateRegex.test(val) || datetimeRegex.test(val);
      },
      { message: 'Invalid date format. Use YYYY-MM-DD or ISO datetime' }
    )
    .or(z.literal('').transform(() => undefined)),
  hireDate: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        return dateRegex.test(val) || datetimeRegex.test(val);
      },
      { message: 'Invalid date format. Use YYYY-MM-DD or ISO datetime' }
    )
    .or(z.literal('').transform(() => undefined)),
  positionId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  gender: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isAdmin: z.boolean().optional(),
  projectIds: z.array(z.string()).optional(),
});

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);
    const { projectIds, ...userData } = data;

    const updateData: any = { ...userData };

    if (data.birthDate && data.birthDate.trim() !== '') {
      // Parse date string (YYYY-MM-DD) as UTC midnight to avoid timezone issues
      const dateStr = data.birthDate.includes('T') 
        ? data.birthDate.split('T')[0] // Extract date part if datetime provided
        : data.birthDate;
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date in UTC midnight (month is 0-indexed in JavaScript Date)
      // This ensures the date is stored correctly regardless of server timezone
      updateData.birthDate = new Date(Date.UTC(year, month - 1, day));
    } else if (data.birthDate === '') {
      updateData.birthDate = null;
    }

    if (data.hireDate && data.hireDate.trim() !== '') {
      const dateStr = data.hireDate.includes('T')
        ? data.hireDate.split('T')[0]
        : data.hireDate;
      const [year, month, day] = dateStr.split('-').map(Number);
      updateData.hireDate = new Date(Date.UTC(year, month - 1, day));
    } else if (data.hireDate === '') {
      updateData.hireDate = null;
    }

    if (data.positionId !== undefined) {
      updateData.positionId = data.positionId || null;
    }

    if (projectIds !== undefined) {
      updateData.projects = {
        set: projectIds.map((projectId) => ({ id: projectId })),
      };
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        projects: true,
        position: true,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

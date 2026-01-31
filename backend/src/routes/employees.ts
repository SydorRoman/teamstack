import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const updateEmployeeSchema = z.object({
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
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        return dateRegex.test(val) || datetimeRegex.test(val);
      },
      { message: 'Invalid date format. Use YYYY-MM-DD or ISO datetime' }
    )
    .or(z.literal('')),
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
    .or(z.literal('')),
  gender: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(6),
});

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { search, positionId, gender } = req.query;
    const technologyIdsRaw = req.query.technologyIds;
    const technologyIds = Array.isArray(technologyIdsRaw)
      ? (technologyIdsRaw as string[])
      : typeof technologyIdsRaw === 'string'
      ? [technologyIdsRaw]
      : [];

    let where: any = {};

    if (search) {
      const terms = String(search)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (terms.length > 0) {
        where.AND = [
          ...(where.AND || []),
          ...terms.map((term) => ({
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          })),
        ];
      }
    }

    if (positionId) {
      where.positionId = positionId as string;
    }

    if (gender) {
      where.gender = gender;
    }

    if (technologyIds.length > 0) {
      where.AND = technologyIds.map((technologyId) => ({
        technologies: {
          some: {
            technologyId,
          },
        },
      }));
    }

    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        positionId: true,
        position: {
          select: {
            id: true,
            name: true,
          },
        },
        gender: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.user.findUnique({
      where: { id },
      include: {
        projects: true,
        entitlements: true,
        position: true,
        technologies: {
          include: {
            technology: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { passwordHash, technologies, ...employeeWithoutPassword } = employee;

    res.json({
      ...employeeWithoutPassword,
      technologies: technologies.map((ut) => ut.technology),
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    if (!isAdmin && userId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = updateEmployeeSchema.parse(req.body);
    const updateData: any = { ...data };

    if (!isAdmin && data.hireDate !== undefined) {
      return res.status(403).json({ error: 'Only admins can update hire date' });
    }

    const nullableFields: Array<keyof typeof data> = [
      'phone',
      'telegram',
      'city',
      'country',
      'gender',
    ];
    nullableFields.forEach((field) => {
      if (data[field] === '') {
        updateData[field] = null;
      }
    });

    if (data.birthDate !== undefined) {
      if (data.birthDate === '') {
        updateData.birthDate = null;
      } else if (data.birthDate) {
        const dateStr = data.birthDate.includes('T')
          ? data.birthDate.split('T')[0]
          : data.birthDate;
        const [year, month, day] = dateStr.split('-').map(Number);
        updateData.birthDate = new Date(Date.UTC(year, month - 1, day));
      }
    }

    if (data.hireDate !== undefined) {
      if (data.hireDate === '') {
        updateData.hireDate = null;
      } else if (data.hireDate) {
        const dateStr = data.hireDate.includes('T')
          ? data.hireDate.split('T')[0]
          : data.hireDate;
        const [year, month, day] = dateStr.split('-').map(Number);
        updateData.hireDate = new Date(Date.UTC(year, month - 1, day));
      }
    }

    const employee = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        projects: true,
        entitlements: true,
        position: true,
      },
    });

    const { passwordHash, ...employeeWithoutPassword } = employee;
    res.json(employeeWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!isAdmin && userId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = updatePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!isAdmin) {
      if (!data.currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import express from 'express';
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
  gender: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
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
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
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

export default router;

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

const createTechnologySchema = z.object({
  name: z.string().min(1, 'Technology name is required'),
});

const updateTechnologySchema = z.object({
  name: z.string().min(1),
});

// Get all technologies (public for users to see, but only admins can modify)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const technologies = await prisma.technology.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json(technologies);
  } catch (error) {
    console.error('Error fetching technologies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users by technology
router.get('/search-users', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { technologyIds } = req.query;

    if (!technologyIds || !Array.isArray(technologyIds) || technologyIds.length === 0) {
      return res.status(400).json({ error: 'At least one technology ID is required' });
    }

    const users = await prisma.user.findMany({
      where: {
        technologies: {
          some: {
            technologyId: {
              in: technologyIds as string[],
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: {
          select: {
            id: true,
            name: true,
          },
        },
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

    const formattedUsers = users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      position: user.position,
      technologies: user.technologies.map((ut: any) => ut.technology),
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error searching users by technology:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create technology (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const data = createTechnologySchema.parse(req.body);

    const technology = await prisma.technology.create({
      data: {
        name: data.name,
      },
    });

    res.status(201).json(technology);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error creating technology:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update technology (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateTechnologySchema.parse(req.body);

    const technology = await prisma.technology.update({
      where: { id },
      data: {
        name: data.name,
      },
    });

    res.json(technology);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error updating technology:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete technology (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.technology.delete({
      where: { id },
    });

    res.json({ message: 'Technology deleted successfully' });
  } catch (error) {
    console.error('Error deleting technology:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


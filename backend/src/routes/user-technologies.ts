import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

const updateUserTechnologiesSchema = z.object({
  technologyIds: z.array(z.string().uuid()),
});

// Get all technologies (any authenticated user)
router.get('/all', authenticateToken, async (_req: AuthRequest, res) => {
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

// Get current user's technologies
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req;

    const userTechnologies = await prisma.userTechnology.findMany({
      where: {
        userId: userId!,
      },
      include: {
        technology: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const technologies = userTechnologies.map((ut) => ut.technology);

    res.json(technologies);
  } catch (error) {
    console.error('Error fetching user technologies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific user's technologies (admin or self)
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    if (!isAdmin && userId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userTechnologies = await prisma.userTechnology.findMany({
      where: {
        userId: id,
      },
      include: {
        technology: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const technologies = userTechnologies.map((ut) => ut.technology);
    res.json(technologies);
  } catch (error) {
    console.error('Error fetching user technologies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user's technologies
router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req;
    const data = updateUserTechnologiesSchema.parse(req.body);

    // Delete existing user technologies
    await prisma.userTechnology.deleteMany({
      where: { userId: userId! },
    });

    // Create new ones
    if (data.technologyIds.length > 0) {
      await prisma.userTechnology.createMany({
        data: data.technologyIds.map((techId) => ({
          userId: userId!,
          technologyId: techId,
        })),
      });
    }

    // Fetch updated technologies
    const userTechnologies = await prisma.userTechnology.findMany({
      where: {
        userId: userId!,
      },
      include: {
        technology: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const technologies = userTechnologies.map((ut: any) => ut.technology);

    res.json(technologies);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error updating user technologies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update specific user's technologies (admin or self)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = req;

    if (!isAdmin && userId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = updateUserTechnologiesSchema.parse(req.body);

    await prisma.userTechnology.deleteMany({
      where: { userId: id },
    });

    if (data.technologyIds.length > 0) {
      await prisma.userTechnology.createMany({
        data: data.technologyIds.map((techId) => ({
          userId: id,
          technologyId: techId,
        })),
      });
    }

    const userTechnologies = await prisma.userTechnology.findMany({
      where: {
        userId: id,
      },
      include: {
        technology: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const technologies = userTechnologies.map((ut: any) => ut.technology);
    res.json(technologies);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error updating user technologies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


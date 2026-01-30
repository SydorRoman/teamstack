import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

const createPositionSchema = z.object({
  name: z.string().min(1, 'Position name is required'),
});

const updatePositionSchema = z.object({
  name: z.string().min(1),
});

// Get all positions (authenticated users can see)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const positions = await prisma.position.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create position (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const data = createPositionSchema.parse(req.body);

    const position = await prisma.position.create({
      data: {
        name: data.name,
      },
    });

    res.status(201).json(position);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error creating position:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update position (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updatePositionSchema.parse(req.body);

    const position = await prisma.position.update({
      where: { id },
      data: {
        name: data.name,
      },
    });

    res.json(position);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error updating position:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete position (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.position.delete({
      where: { id },
    });

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


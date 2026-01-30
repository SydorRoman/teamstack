import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getAllEntitlements } from '../services/entitlementService.js';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req;

    // Get detailed entitlements breakdown
    const entitlements = await getAllEntitlements(userId!);

    // Get history (all absences except rejected)
    const absences = await prisma.absence.findMany({
      where: {
        userId: userId!,
      },
      orderBy: {
        from: 'desc',
      },
    });

    res.json({
      entitlements,
      history: absences,
    });
  } catch (error) {
    console.error('Error fetching entitlements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

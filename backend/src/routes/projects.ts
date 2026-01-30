import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken, requireAdmin);

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  userIds: z.array(z.string().uuid()).optional(),
  technologyIds: z.array(z.string().uuid()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  technologyIds: z.array(z.string().uuid()).optional(),
});

// Get all projects with users and technologies
router.get('/', async (req: AuthRequest, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedProjects = projects.map((project) => ({
      ...project,
      technologies: project.technologies.map((pt) => pt.technology),
    }));

    res.json(formattedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single project
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      ...project,
      technologies: project.technologies.map((pt) => pt.technology),
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create project
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        name: data.name,
        users: data.userIds
          ? {
              connect: data.userIds.map((id) => ({ id })),
            }
          : undefined,
        technologies: data.technologyIds
          ? {
              create: data.technologyIds.map((techId) => ({
                technology: {
                  connect: { id: techId },
                },
              })),
            }
          : undefined,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

    res.status(201).json({
      ...project,
      technologies: project.technologies.map((pt) => pt.technology),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateProjectSchema.parse(req.body);

    const updateData: any = {};

    if (data.name) {
      updateData.name = data.name;
    }

    // Update users if provided
    if (data.userIds !== undefined) {
      updateData.users = {
        set: data.userIds.map((userId) => ({ id: userId })),
      };
    }

    // Update technologies if provided
    if (data.technologyIds !== undefined) {
      // Delete existing project technologies
      await prisma.projectTechnology.deleteMany({
        where: { projectId: id },
      });

      // Create new ones
      if (data.technologyIds.length > 0) {
        await prisma.projectTechnology.createMany({
          data: data.technologyIds.map((techId) => ({
            projectId: id,
            technologyId: techId,
          })),
        });
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

    res.json({
      ...project,
      technologies: project.technologies.map((pt) => pt.technology),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: error.errors.map((e) => e.message).join('. '),
      });
    }
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete project
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.project.delete({
      where: { id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


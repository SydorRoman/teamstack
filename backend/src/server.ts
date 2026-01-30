import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import absenceRoutes from './routes/absences.js';
import employeeRoutes from './routes/employees.js';
import entitlementRoutes from './routes/entitlements.js';
import adminRoutes from './routes/admin.js';
import workLogRoutes from './routes/worklogs.js';
import projectRoutes from './routes/projects.js';
import technologyRoutes from './routes/technologies.js';
import userTechnologyRoutes from './routes/user-technologies.js';
import positionRoutes from './routes/positions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/entitlements', entitlementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/worklogs', workLogRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/technologies', technologyRoutes);
app.use('/api/user-technologies', userTechnologyRoutes);
app.use('/api/positions', positionRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

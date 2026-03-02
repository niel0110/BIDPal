import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())



import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';

app.get('/', (req, res) => {
  res.json({ message: "Backend running" })
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sellers', sellerRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})
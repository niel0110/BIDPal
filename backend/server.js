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
import ordersRoutes from './routes/ordersRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import productsRoutes from './routes/productsRoutes.js';
import addressesRoutes from './routes/addressesRoutes.js';
import auctionsRoutes from './routes/auctionsRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import messagesRoutes from './routes/messagesRoutes.js';

app.get('/', (req, res) => {
  res.json({ message: "Backend running" })
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/auctions', auctionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messagesRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})
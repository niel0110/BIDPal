import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'

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
import agoraRoutes from './routes/agoraRoutes.js';

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
app.use('/api/agora', agoraRoutes);

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
})

io.on('connection', (socket) => {
  // Join an auction room
  socket.on('join-auction', (auctionId) => {
    socket.join(`auction:${auctionId}`)
  })

  // Broadcast new bid to everyone in the auction room
  socket.on('new-bid', ({ auctionId, bid }) => {
    io.to(`auction:${auctionId}`).emit('bid-update', bid)
  })

  // Broadcast a comment to everyone in the auction room
  socket.on('send-comment', ({ auctionId, comment }) => {
    io.to(`auction:${auctionId}`).emit('new-comment', comment)
  })

  socket.on('disconnect', () => {})
})

httpServer.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})

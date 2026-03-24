import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { supabase } from './config/supabase.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)

// Socket.IO setup for real-time events (future native clients)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
})

// Expose io to routes via app.locals
app.locals.io = io

io.on('connection', (socket) => {
  // Client joins their own user room for targeted events
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`)
  })

  // Join an auction room
  socket.on('join-auction', (auctionId) => {
    socket.join(`auction:${auctionId}`)
  })

  // Broadcast new bid to everyone in the auction room
  socket.on('new-bid', ({ auctionId, bid }) => {
    io.to(`auction:${auctionId}`).emit('bid-update', bid)
  })

  // Broadcast a comment to everyone in the auction room AND persist to DB
  socket.on('send-comment', ({ auctionId, comment }) => {
    // Broadcast immediately so all viewers see it in real time
    io.to(`auction:${auctionId}`).emit('new-comment', comment)

    // Persist asynchronously — fire and forget (non-blocking)
    supabase
      .from('Live_Comments')
      .insert([{
        auction_id: auctionId,
        user_id: comment.user_id || null,
        username: comment.user || 'Guest',
        text: comment.text
      }])
      .then(({ error }) => {
        if (error) console.error('Failed to persist comment:', error.message)
      })
  })

  socket.on('disconnect', () => {})
})


app.use(cors())
app.use(express.json())

import userRoutes from './routes/userRoutes.js'
import authRoutes from './routes/authRoutes.js'
import sellerRoutes from './routes/sellerRoutes.js'
import ordersRoutes from './routes/ordersRoutes.js'
import cartRoutes from './routes/cartRoutes.js'
import productsRoutes from './routes/productsRoutes.js'
import addressesRoutes from './routes/addressesRoutes.js'
import auctionsRoutes from './routes/auctionsRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import messagesRoutes from './routes/messagesRoutes.js'
import followsRoutes from './routes/followsRoutes.js'
import notificationsRoutes from './routes/notificationsRoutes.js'
import agoraRoutes from './routes/agoraRoutes.js'
import priceRecommendationRoutes from './routes/priceRecommendationRoutes.js'

app.get('/', (req, res) => {
  res.json({ message: 'Backend running' })
})

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() })
})

app.use('/api/users', userRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/seller', sellerRoutes)
app.use('/api/sellers', sellerRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/addresses', addressesRoutes)
app.use('/api/auctions', auctionsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/follows', followsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/agora', agoraRoutes)
app.use('/api', priceRecommendationRoutes)

httpServer.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${process.env.PORT}`)
  console.log(`Network access: http://10.0.19.203:${process.env.PORT}`)
})

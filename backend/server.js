import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { supabase } from './config/supabase.js'

const app = express()
const httpServer = createServer(app)

// Socket.IO setup for real-time events (future native clients)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ["https://bidpal.shop", "https://www.bidpal.shop", 'https://admin.bidpal.shop', "https://bid-pal-pink.vercel.app"],
    methods: ['GET', 'POST'],
    credentials: true
  }
})

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use(cors({
  origin: [
    'https://bidpal.shop',
    'https://www.bidpal.shop',
    'https://bid-pal-pink.vercel.app',
    'https://admin.bidpal.shop',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177'
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Expose io to routes via app.locals
app.locals.io = io

// Track active viewers per auction
const auctionViewers = new Map() // auctionId -> Set of socket IDs

// Track blocked users per auction
const blockedUsers = new Map() // auctionId -> Set of user_ids

// Helper to get viewer count
const getViewerCount = (auctionId) => {
  return auctionViewers.get(auctionId)?.size || 0
}

// Helper to broadcast viewer count
const broadcastViewerCount = (auctionId) => {
  const count = getViewerCount(auctionId)
  io.to(`auction:${auctionId}`).emit('viewer-count', count)
}

io.on('connection', (socket) => {
  // Client joins their own user room for targeted events
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`)
  })

  // Join an auction room — sellers pass { auctionId, role: 'seller' } to skip viewer count
  socket.on('join-auction', (payload) => {
    const auctionId = typeof payload === 'object' ? payload.auctionId : payload
    const role = typeof payload === 'object' ? payload.role : 'viewer'

    socket.join(`auction:${auctionId}`)
    socket.currentAuction = auctionId
    socket.currentRole = role

    // Only count actual viewers (not the seller)
    if (role !== 'seller') {
      if (!auctionViewers.has(auctionId)) {
        auctionViewers.set(auctionId, new Set())
      }
      auctionViewers.get(auctionId).add(socket.id)
      broadcastViewerCount(auctionId)
    }
  })

  // Leave an auction room
  socket.on('leave-auction', (auctionId) => {
    socket.leave(`auction:${auctionId}`)

    if (socket.currentRole !== 'seller' && auctionViewers.has(auctionId)) {
      auctionViewers.get(auctionId).delete(socket.id)
      if (auctionViewers.get(auctionId).size === 0) {
        auctionViewers.delete(auctionId)
      }
      broadcastViewerCount(auctionId)
    }
  })

  // Broadcast new bid to everyone in the auction room
  socket.on('new-bid', async ({ auctionId, bid }) => {
    // Drop bid broadcast if user is blocked
    if (bid.user_id && blockedUsers.get(auctionId)?.has(String(bid.user_id))) return

    // Broadcast the new bid
    io.to(`auction:${auctionId}`).emit('bid-update', bid)

    // Also fetch and broadcast updated bidder count
    try {
      const { data: uniqueBidders } = await supabase
        .from('Bids')
        .select('user_id')
        .eq('auction_id', auctionId);

      const uniqueBidderCount = new Set(uniqueBidders?.map(b => b.user_id)).size;

      io.to(`auction:${auctionId}`).emit('bidder-count-update', {
        bidderCount: uniqueBidderCount,
        latestBid: bid
      });
    } catch (err) {
      console.error('Failed to update bidder count:', err);
    }
  })

  // Seller blocks a buyer from the live auction
  socket.on('block-buyer', ({ auctionId, userId }) => {
    if (socket.currentRole !== 'seller') return

    if (!blockedUsers.has(auctionId)) blockedUsers.set(auctionId, new Set())
    blockedUsers.get(auctionId).add(String(userId))

    // Notify the blocked user directly via their user room
    io.to(`user:${userId}`).emit('you-are-blocked', { auctionId })

    // Tell everyone else this user was removed so their msgs can be filtered
    io.to(`auction:${auctionId}`).emit('buyer-blocked', { userId })
  })

  // Broadcast a comment to everyone in the auction room AND persist to DB
  socket.on('send-comment', ({ auctionId, comment }) => {
    // Drop comment if user is blocked
    if (comment.user_id && blockedUsers.get(auctionId)?.has(String(comment.user_id))) return

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

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.currentAuction && socket.currentRole !== 'seller') {
      const auctionId = socket.currentAuction
      if (auctionViewers.has(auctionId)) {
        auctionViewers.get(auctionId).delete(socket.id)
        if (auctionViewers.get(auctionId).size === 0) {
          auctionViewers.delete(auctionId)
        }
        broadcastViewerCount(auctionId)
      }
    }
  })
})

// Expose viewer tracking functions to routes
app.locals.getViewerCount = getViewerCount


app.use(express.json({ limit: '20mb' }))

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
import violationsRoutes from './routes/violationsRoutes.js'
import reviewsRoutes from './routes/reviewsRoutes.js'
import imageModerationRoutes from './routes/imageModerationRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import disputesRoutes from './routes/disputesRoutes.js'
import bannerRoutes from './routes/bannerRoutes.js'
import supportRoutes from './routes/supportRoutes.js'

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
app.use('/api/violations', violationsRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/image-moderation', imageModerationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/disputes', disputesRoutes)
app.use('/api/banner', bannerRoutes)
app.use('/api/support', supportRoutes)

httpServer.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${process.env.PORT}`)
  console.log(`Network access: http://10.0.19.203:${process.env.PORT}`)
})

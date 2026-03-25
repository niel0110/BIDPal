import { supabase } from '../config/supabase.js';

// Get dashboard summary (active auction and queue)
export const getDashboardSummary = async (req, res) => {
  try {
    const { seller_id, user_id } = req.query;

    if (!seller_id && !user_id) {
      return res.status(400).json({ error: 'seller_id or user_id is required' });
    }

    let final_seller_id = seller_id;

    if (!final_seller_id && user_id) {
      const { data: sellerData, error: sellerError } = await supabase
        .from('Seller')
        .select('seller_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (sellerError) throw sellerError;
      if (!sellerData) return res.status(404).json({ error: 'Seller not found' });
      final_seller_id = sellerData.seller_id;
    }

    // Get viewer count function from app.locals (set in server.js)
    const getViewerCount = req.app.locals.getViewerCount || (() => 0);

    // 1. Get Active Auction (selling)
    const { data: activeAuction, error: activeError } = await supabase
      .from('Auctions')
      .select('*, products:Products(*, images:Product_Images(*)), bids:Bids(count)')
      .eq('seller_id', final_seller_id)
      .eq('status', 'active')
      .maybeSingle();

    if (activeError) throw activeError;

    // Auto-end if expired
    let currentActiveAuction = activeAuction;
    if (activeAuction && new Date(activeAuction.end_time) < new Date()) {
        console.log(`Auction ${activeAuction.auction_id} has expired. Marking as ended.`);
        const { error: endError } = await supabase
            .from('Auctions')
            .update({ status: 'ended' })
            .eq('auction_id', activeAuction.auction_id)
            .select('*, products:Products(*, images:Product_Images(*)), bids:Bids(count)')
            .single();

        if (!endError) {
            // Also update product status
            await supabase
                .from('Products')
                .update({ status: 'inactive' })
                .eq('products_id', activeAuction.products_id);

            currentActiveAuction = null;
        }
    }

    // 2. Get Auction Queue (scheduled)
    const { data: queue, error: queueError } = await supabase
      .from('Auctions')
      .select('*, products:Products(*, images:Product_Images(*))')
      .eq('seller_id', final_seller_id)
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true });

    if (queueError) throw queueError;

    // 3. Get Completed Auctions (ended)
    const { data: completed, error: completedError } = await supabase
      .from('Auctions')
      .select('*, products:Products(*, images:Product_Images(*)), bids:Bids(count)')
      .eq('seller_id', final_seller_id)
      .eq('status', 'ended')
      .order('end_time', { ascending: false })
      .limit(10);

    if (completedError) throw completedError;

    // Calculate live duration if there's an active auction
    let liveDuration = null;
    if (currentActiveAuction && currentActiveAuction.start_time) {
      const startTime = new Date(currentActiveAuction.start_time);
      const now = new Date();
      const durationMs = now - startTime;

      // Convert to hours, minutes, seconds
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

      liveDuration = {
        hours,
        minutes,
        seconds,
        totalSeconds: Math.floor(durationMs / 1000)
      };
    }

    // Get real-time viewer count for active auction
    const auctionId = currentActiveAuction?.auction_id;
    const liveViewers = auctionId ? getViewerCount(auctionId) : 0;

    // Get shares and likes count from database
    let shares = 0;
    let likes = 0;

    if (auctionId) {
      // Count shares
      const { count: sharesCount } = await supabase
        .from('Auction_Shares')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auctionId);
      shares = sharesCount || 0;

      // Count likes
      const { count: likesCount } = await supabase
        .from('Auction_Likes')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auctionId);
      likes = likesCount || 0;
    }

    // Count persisted total views from Auction_Views table
    let totalViews = 0;
    if (auctionId) {
      const { count: viewsCount } = await supabase
        .from('Auction_Views')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auctionId);
      totalViews = viewsCount || 0;
    }

    res.json({
      activeAuction: currentActiveAuction,
      queue,
      completed,
      liveDuration,
      stats: {
        viewers: Math.max(liveViewers, totalViews),
        liveViewers,
        totalViews,
        shares: shares,
        likes: likes
      }
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get recent bids for an auction
export const getAuctionBids = async (req, res) => {
  try {
    const { id } = req.params;

    // Get recent bids with bidder information
    const { data: bids, error } = await supabase
      .from('Bids')
      .select('bid_id, bid_amount, placed_at, user_id, bidder:User(user_id, Fname, Lname, Avatar, email)')
      .eq('auction_id', id)
      .order('placed_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Count unique bidders
    const { data: uniqueBidders, error: countError } = await supabase
      .from('Bids')
      .select('user_id')
      .eq('auction_id', id);

    if (countError) throw countError;

    const uniqueBidderCount = new Set(uniqueBidders?.map(b => b.user_id)).size;

    // Format response with additional info
    const formattedBids = bids.map(bid => {
      const fName = bid.bidder?.Fname;
      const lName = bid.bidder?.Lname;
      const emailName = bid.bidder?.email ? bid.bidder.email.split('@')[0] : 'User';
      const fullName = (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : emailName;
      
      return {
        bid_id: bid.bid_id,
        user_id: bid.user_id,
        amount: bid.bid_amount,
        bidder_name: fullName,
      bidder_avatar: bid.bidder?.Avatar || null,
      timestamp: bid.placed_at,
      timeAgo: getTimeAgo(bid.placed_at)
    };
    });

    res.json({
      bids: formattedBids,
      bidderCount: uniqueBidderCount,
      totalBids: bids.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper function to calculate time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Share an auction
export const shareAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Insert share record
    const { error } = await supabase
      .from('Auction_Shares')
      .insert([{
        auction_id: id,
        user_id: user_id || null,
        shared_at: new Date().toISOString()
      }]);

    if (error) throw error;

    // Get updated share count
    const { count } = await supabase
      .from('Auction_Shares')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', id);

    // Broadcast update via Socket.IO
    if (req.app.locals.io) {
      req.app.locals.io.to(`auction:${id}`).emit('share-update', count || 0);
    }

    res.json({ success: true, shareCount: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Like/Unlike an auction
export const toggleLikeAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('Auction_Likes')
      .select('*')
      .eq('auction_id', id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingLike) {
      // Unlike - remove the like
      await supabase
        .from('Auction_Likes')
        .delete()
        .eq('auction_id', id)
        .eq('user_id', user_id);
    } else {
      // Like - add the like
      await supabase
        .from('Auction_Likes')
        .insert([{
          auction_id: id,
          user_id: user_id,
          liked_at: new Date().toISOString()
        }]);
    }

    // Get updated like count
    const { count } = await supabase
      .from('Auction_Likes')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', id);

    // Broadcast update via Socket.IO
    if (req.app.locals.io) {
      req.app.locals.io.to(`auction:${id}`).emit('like-update', count || 0);
    }

    res.json({
      success: true,
      liked: !existingLike,
      likeCount: count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Track a view/join event for an auction (persisted to Auction_Views)
export const trackAuctionView = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, session_id } = req.body;

    await supabase
      .from('Auction_Views')
      .insert([{
        auction_id: id,
        user_id: user_id || null,
        session_id: session_id || null,
        viewed_at: new Date().toISOString()
      }]);

    // Return updated view count
    const { count } = await supabase
      .from('Auction_Views')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', id);

    // Broadcast update via Socket.IO
    if (req.app.locals.io) {
      req.app.locals.io.to(`auction:${id}`).emit('total-views-update', count || 0);
    }

    res.json({ success: true, viewCount: count || 0 });
  } catch (err) {
    // Non-critical — don't fail the user's experience
    res.json({ success: false });
  }
};

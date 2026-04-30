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

    // 1. Get Active Auction (selling — bid auctions only, not fixed price)
    const { data: activeAuction, error: activeError } = await supabase
      .from('Auctions')
      .select('*')
      .eq('seller_id', final_seller_id)
      .eq('status', 'active')
      .or('sale_type.eq.bid,sale_type.is.null')
      .maybeSingle();

    if (activeError) throw activeError;

    // Fetch product details separately if there's an active auction
    if (activeAuction && activeAuction.products_id) {
      const { data: productData } = await supabase
        .from('vw_product_details')
        .select('*')
        .eq('products_id', activeAuction.products_id)
        .maybeSingle();

      if (productData) {
        activeAuction.products = productData;
      }

      // Get bid count for active auction
      const { count: bidCount } = await supabase
        .from('Bids')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', activeAuction.auction_id);

      activeAuction.bids = [{ count: bidCount || 0 }];
    }

    // Auto-end if expired AND has been live for more than 24 hours (safety check)
    // Don't auto-end ongoing live sessions that seller is actively controlling
    let currentActiveAuction = activeAuction;
    if (activeAuction && activeAuction.live_started_at) {
        const liveStarted = new Date(activeAuction.live_started_at);
        const now = new Date();
        const hoursLive = (now - liveStarted) / (1000 * 60 * 60);

        // Only auto-end if live for more than 24 hours (safety check for abandoned streams)
        if (hoursLive > 24) {
            console.log(`Auction ${activeAuction.auction_id} has been live for ${hoursLive} hours. Auto-ending for safety.`);
            const { error: endError } = await supabase
                .from('Auctions')
                .update({
                    status: 'ended',
                    live_ended_at: new Date().toISOString()
                })
                .eq('auction_id', activeAuction.auction_id);

            if (!endError) {
                // Also update product status
                await supabase
                    .from('Products')
                    .update({ status: 'inactive' })
                    .eq('products_id', activeAuction.products_id);

                currentActiveAuction = null;
            }
        }
    }

    // 2. Get Auction Queue (scheduled bid auctions only — exclude fixed price sale_type='sale')
    const { data: queueAuctions, error: queueError } = await supabase
      .from('Auctions')
      .select('*')
      .eq('seller_id', final_seller_id)
      .eq('status', 'scheduled')
      .or('sale_type.eq.bid,sale_type.is.null')
      .order('start_time', { ascending: true });

    if (queueError) throw queueError;

    // Fetch product details for queue
    const queue = await Promise.all(
      (queueAuctions || []).map(async (auction) => {
        const { data: productData } = await supabase
          .from('vw_product_details')
          .select('*')
          .eq('products_id', auction.products_id)
          .maybeSingle();

        return {
          ...auction,
          products: productData
        };
      })
    );

    // 3. Get Completed Auctions (ended)
    const { data: completedAuctions, error: completedError } = await supabase
      .from('Auctions')
      .select('*')
      .eq('seller_id', final_seller_id)
      .eq('status', 'ended')
      .order('end_time', { ascending: false })
      .limit(10);

    if (completedError) { console.warn('Completed auctions query error:', completedError.message); }

    // Fetch product details, bid counts, and winner info for completed auctions
    const completed = await Promise.all(
      (completedAuctions || []).map(async (auction) => {
        const { data: productData } = await supabase
          .from('vw_product_details')
          .select('*')
          .eq('products_id', auction.products_id)
          .maybeSingle();

        const { count: bidCount } = await supabase
          .from('Bids')
          .select('*', { count: 'exact', head: true })
          .eq('auction_id', auction.auction_id);

        // Fetch winner information if auction has a winner
        let winner = null;
        if (auction.winner_user_id && auction.winning_bid_id) {
          const { data: winningBid } = await supabase
            .from('Bids')
            .select('bid_id, bid_amount, placed_at, user_id')
            .eq('bid_id', auction.winning_bid_id)
            .maybeSingle();

          if (winningBid) {
            const { data: bidderUser } = await supabase
              .from('User')
              .select('user_id, Fname, Lname, Avatar, email')
              .eq('user_id', winningBid.user_id)
              .maybeSingle();

            const fName = bidderUser?.Fname;
            const lName = bidderUser?.Lname;
            const emailName = bidderUser?.email ? bidderUser.email.split('@')[0] : 'Winner';
            const fullName = (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : emailName;

            winner = {
              user_id: winningBid.user_id,
              name: fullName,
              avatar: bidderUser?.Avatar || null,
              bid_amount: winningBid.bid_amount,
              placed_at: winningBid.placed_at
            };
          }
        }

        return {
          ...auction,
          products: productData,
          bids: [{ count: bidCount || 0 }],
          winner: winner
        };
      })
    );

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

    // Get shares, likes and views — wrapped individually so a missing table doesn't 500 the endpoint
    let shares = 0;
    let likes = 0;
    let totalViews = 0;

    if (auctionId) {
      const [sharesRes, likesRes, viewsRes] = await Promise.allSettled([
        supabase.from('Auction_Shares').select('*', { count: 'exact', head: true }).eq('auction_id', auctionId),
        supabase.from('Auction_Likes').select('*', { count: 'exact', head: true }).eq('auction_id', auctionId),
        supabase.from('Auction_Views').select('*', { count: 'exact', head: true }).eq('auction_id', auctionId),
      ]);
      if (sharesRes.status === 'fulfilled' && !sharesRes.value.error) shares = sharesRes.value.count || 0;
      if (likesRes.status === 'fulfilled' && !likesRes.value.error) likes = likesRes.value.count || 0;
      if (viewsRes.status === 'fulfilled' && !viewsRes.value.error) totalViews = viewsRes.value.count || 0;
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
      .select('bid_id, bid_amount, placed_at, user_id')
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

    // Fetch user info separately to avoid FK join issues
    const bidderIds = [...new Set((bids || []).map(b => b.user_id))];
    let bidderMap = {};
    if (bidderIds.length > 0) {
      const { data: bidderUsers } = await supabase
        .from('User')
        .select('user_id, Fname, Lname, Avatar, email')
        .in('user_id', bidderIds);
      (bidderUsers || []).forEach(u => { bidderMap[u.user_id] = u; });
    }

    const formattedBids = bids.map(bid => {
      const bidder = bidderMap[bid.user_id] || {};
      const fName = bidder.Fname;
      const lName = bidder.Lname;
      const emailName = bidder.email ? bidder.email.split('@')[0] : 'User';
      const fullName = (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : emailName;

      return {
        bid_id: bid.bid_id,
        user_id: bid.user_id,
        amount: bid.bid_amount,
        bidder_name: fullName,
        bidder_avatar: bidder.Avatar || null,
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

// Get a user's wishlist (liked auctions)
export const getWishlist = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // 1. Get all liked auctions for the user
    const { data: likes, error: likesError } = await supabase
      .from('Auction_Likes')
      .select('auction_id, liked_at')
      .eq('user_id', user_id)
      .order('liked_at', { ascending: false });

    if (likesError) throw likesError;

    if (!likes || likes.length === 0) {
      return res.json([]);
    }

    const auctionIds = likes.map(l => l.auction_id);

    // 2. Fetch auction and product details for these IDs
    const { data: auctions, error: auctionsError } = await supabase
      .from('Auctions')
      .select(`
        auction_id,
        products_id,
        seller_id,
        status,
        start_time,
        end_time,
        reserve_price,
        buy_now_price,
        current_price,
        incremental_bid_step,
        Seller (
          store_name,
          logo_url
        )
      `)
      .in('auction_id', auctionIds);

    if (auctionsError) throw auctionsError;

    // 3. Enrich with product details from view
    const wishlistItems = await Promise.all(
      likes.map(async (like) => {
        const auction = auctions.find(a => a.auction_id === like.auction_id);
        if (!auction) return null;

        const { data: productData, error: productError } = await supabase
          .from('vw_product_details')
          .select('*')
          .eq('products_id', auction.products_id)
          .maybeSingle();

        if (productError) {
          console.error(`Error fetching product details for ${auction.products_id}:`, productError);
          // Continue anyway, just fallback to minimal data
        }

        const images = productData?.images || [];
        const primaryImage = images.find(img => img.is_primary) || images[0];

        return {
          id: auction.auction_id,
          liked_at: like.liked_at,
          auction_id: auction.auction_id,
          product_id: auction.products_id,
          title: productData?.name || 'Unknown Product',
          description: productData?.description,
          image: primaryImage?.image_url || null,
          seller: auction.Seller?.store_name || 'Unknown Seller',
          seller_logo: auction.Seller?.logo_url,
          status: auction.status,
          start_time: auction.start_time,
          end_time: auction.end_time,
          current_price: auction.current_price || auction.reserve_price || 0,
          buy_now_price: auction.buy_now_price || 0,
          is_liked: true
        };
      })
    );

    res.json(wishlistItems.filter(item => item !== null));
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

import { supabase } from '../config/supabase.js';

// Get dashboard summary (active auction and queue)
export const getDashboardSummary = async (req, res) => {
  const { seller_id, user_id } = req.query;

  if (!seller_id && !user_id) {
    return res.status(400).json({ error: 'seller_id or user_id is required' });
  }

  // ── Resolve seller_id ──────────────────────────────────────────────────────
  let final_seller_id = null;
  try {
    if (user_id) {
      const { data: sellerData } = await supabase
        .from('Seller').select('seller_id').eq('user_id', user_id).maybeSingle();
      if (sellerData) final_seller_id = sellerData.seller_id;
    }
    if (!final_seller_id && seller_id) final_seller_id = seller_id;
  } catch (e) {
    console.error('[dashboard] seller lookup error:', e.message);
  }

  if (!final_seller_id) {
    return res.status(404).json({ error: 'Seller not found' });
  }

  const getViewerCount = req.app.locals.getViewerCount || (() => 0);

  // ── 1. Active auction ──────────────────────────────────────────────────────
  let currentActiveAuction = null;
  try {
    const { data: activeAuction } = await supabase
      .from('Auctions').select('*')
      .eq('seller_id', final_seller_id).eq('status', 'active').maybeSingle();

    if (activeAuction) {
      if (activeAuction.products_id) {
        const { data: productData } = await supabase
          .from('vw_product_details').select('*')
          .eq('products_id', activeAuction.products_id).maybeSingle();
        if (productData) activeAuction.products = productData;
      }
      const { count: bidCount } = await supabase
        .from('Bids').select('*', { count: 'exact', head: true })
        .eq('auction_id', activeAuction.auction_id);
      activeAuction.bids = [{ count: bidCount || 0 }];
      currentActiveAuction = activeAuction;
    }
  } catch (e) {
    console.error('[dashboard] active auction error:', e.message);
  }

  // ── 2. Queue (scheduled auctions) ─────────────────────────────────────────
  let queue = [];
  try {
    const { data: queueAuctions } = await supabase
      .from('Auctions').select('*')
      .eq('seller_id', final_seller_id).eq('status', 'scheduled')
      .order('start_time', { ascending: true });

    const nowTs = new Date();
    const expiredIds = (queueAuctions || [])
      .filter(a => a.start_time && new Date(a.start_time) <= nowTs)
      .map(a => a.auction_id);

    if (expiredIds.length > 0) {
      await supabase.from('Auctions').update({ status: 'ended' }).in('auction_id', expiredIds);
      const expiredProductIds = (queueAuctions || [])
        .filter(a => expiredIds.includes(a.auction_id) && a.products_id)
        .map(a => a.products_id);
      if (expiredProductIds.length > 0) {
        await supabase.from('Products').update({ status: 'inactive' }).in('products_id', expiredProductIds);
      }
    }

    const futureAuctions = (queueAuctions || []).filter(a => !expiredIds.includes(a.auction_id));

    queue = await Promise.allSettled(
      futureAuctions.map(async (auction) => {
        const { data: productData } = await supabase
          .from('vw_product_details').select('*')
          .eq('products_id', auction.products_id).maybeSingle();
        return { ...auction, products: productData };
      })
    ).then(results => results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
    );
  } catch (e) {
    console.error('[dashboard] queue error:', e.message);
  }

  // ── 3. Completed auctions ──────────────────────────────────────────────────
  let completed = [];
  try {
    const { data: completedAuctions } = await supabase
      .from('Auctions').select('*')
      .eq('seller_id', final_seller_id).eq('status', 'ended')
      .order('created_at', { ascending: false }).limit(10);

    completed = await Promise.allSettled(
      (completedAuctions || []).map(async (auction) => {
        const { data: productData } = await supabase
          .from('vw_product_details').select('*')
          .eq('products_id', auction.products_id).maybeSingle();
        const { count: bidCount } = await supabase
          .from('Bids').select('*', { count: 'exact', head: true })
          .eq('auction_id', auction.auction_id);
        return { ...auction, products: productData, bids: [{ count: bidCount || 0 }], winner: null };
      })
    ).then(results => results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
    );
  } catch (e) {
    console.error('[dashboard] completed auctions error:', e.message);
  }

  // ── 4. Stats ───────────────────────────────────────────────────────────────
  const auctionId = currentActiveAuction?.auction_id;
  const liveViewers = auctionId ? getViewerCount(auctionId) : 0;
  let shares = 0, likes = 0, totalViews = 0;

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
    liveDuration: null,
    stats: { viewers: liveViewers, liveViewers, totalViews, shares, likes }
  });
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
          product_status: productData?.status || 'active',
          availability: productData?.availability || 1,
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

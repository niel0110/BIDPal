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
        const { data: endedAuction, error: endError } = await supabase
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

    res.json({
      activeAuction: currentActiveAuction,
      queue,
      completed,
      stats: {
        viewers: 0, // Placeholder
        shares: 0,
        likes: 0
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

    const { data, error } = await supabase
      .from('Bids')
      .select('*, bidder:User(Fname, Lname)')
      .eq('auction_id', id)
      .order('placed_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

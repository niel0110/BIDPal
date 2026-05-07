import { supabase } from '../config/supabase.js';

// Submit a review for a completed auction order
export const submitReview = async (req, res) => {
  try {
    const { order_id, seller_id, user_id, rating, comment } = req.body;

    if (!order_id || !seller_id || !user_id || !rating) {
      return res.status(400).json({ error: 'order_id, seller_id, user_id, and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify the order belongs to this user and is completed
    const { data: order, error: orderError } = await supabase
      .from('Orders')
      .select('order_id, status, user_id, auction_id')
      .eq('order_id', order_id)
      .eq('user_id', user_id)
      .eq('status', 'completed')
      .single();

    if (orderError || !order) {
      return res.status(403).json({ error: 'Order not found or not eligible for review' });
    }

    // Prevent duplicate review for the same order
    const { data: existingRows } = await supabase
      .from('Reviews')
      .select('order_id')
      .eq('order_id', order_id)
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      return res.status(409).json({ error: 'You have already reviewed this order' });
    }

    // Get products_id from the order's auction
    let products_id = null;
    if (order.auction_id) {
      const { data: auctionData } = await supabase
        .from('Auctions')
        .select('products_id')
        .eq('auction_id', order.auction_id)
        .single();
      products_id = auctionData?.products_id || null;
    }
    if (!products_id) {
      // Fallback: get from Order_items
      const { data: itemData } = await supabase
        .from('Order_items')
        .select('products_id')
        .eq('order_id', order_id)
        .maybeSingle();
      products_id = itemData?.products_id || null;
    }

    // If products_id is still null, omit it from the insert entirely
    // (requires products_id to be nullable — run: ALTER TABLE "Reviews" ALTER COLUMN products_id DROP NOT NULL)

    // Insert review — reviewers_id mirrors user_id (original schema column name)
    const reviewRow = {
      order_id,
      seller_id,
      user_id,
      reviewers_id: user_id,
      rating,
      comment: comment?.trim() || null
    };
    if (products_id) reviewRow.products_id = products_id;

    const { data: review, error: insertError } = await supabase
      .from('Reviews')
      .insert([reviewRow])
      .select('*')
      .single();

    if (insertError) {
      console.error('Review insert error:', insertError);
      // Unique constraint violation — already reviewed
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'You have already reviewed this order' });
      }
      return res.status(500).json({ error: insertError.message });
    }

    // Notify seller
    await supabase
      .from('Notifications')
      .insert([{
        user_id: (await supabase
          .from('Seller')
          .select('user_id')
          .eq('seller_id', seller_id)
          .single()).data?.user_id,
        type: 'review',
        title: `⭐ New ${rating}-star review`,
        message: comment?.trim()
          ? `A buyer left a ${rating}-star review: "${comment.trim().slice(0, 80)}"`
          : `A buyer left a ${rating}-star review on your auction.`,
        reference_id: order_id,
        reference_type: 'order'
      }]);

    res.status(201).json({ success: true, review });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get review for a specific order (so the buyer knows if they already reviewed)
export const getReviewByOrder = async (req, res) => {
  try {
    const { order_id } = req.params;

    const { data, error } = await supabase
      .from('Reviews')
      .select('rating, comment, created_at')
      .eq('order_id', order_id)
      .limit(1);

    if (error) {
      console.error('[getReviewByOrder] error:', error.code, error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json(data?.[0] ?? null);
  } catch (err) {
    console.error('[getReviewByOrder] unexpected:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get all reviews for a seller (for seller analytics / store page)
export const getSellerReviews = async (req, res) => {
  try {
    const { seller_id } = req.params;

    // Resolve seller's user_id so we can catch reviews stored with either ID
    const { data: sellerRow } = await supabase
      .from('Seller')
      .select('user_id')
      .eq('seller_id', seller_id)
      .maybeSingle();
    const queryIds = sellerRow?.user_id
      ? [seller_id, sellerRow.user_id]
      : [seller_id];

    // Step 1: fetch reviews without FK join (avoids silent failure when FK hint not defined)
    const { data, error } = await supabase
      .from('Reviews')
      .select('review_id, rating, comment, created_at, products_id, order_id, reviewers_id, user_id')
      .in('seller_id', queryIds)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.json([]);

    // Step 2: batch-fetch reviewer info separately
    const reviewerIds = [...new Set(data.map(r => r.reviewers_id || r.user_id).filter(Boolean))];
    let userMap = {};
    if (reviewerIds.length > 0) {
      const { data: users } = await supabase
        .from('User')
        .select('user_id, Fname, Lname, Avatar')
        .in('user_id', reviewerIds);
      if (users) {
        users.forEach(u => { userMap[u.user_id] = u; });
      }
    }

    // Step 3: batch-fetch product names
    const productIds = [...new Set(data.filter(r => r.products_id).map(r => r.products_id))];
    let productMap = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('Products')
        .select('products_id, name')
        .in('products_id', productIds);
      if (products) {
        products.forEach(p => { productMap[p.products_id] = p.name; });
      }
    }

    const formatted = data.map(r => {
      const uid = r.reviewers_id || r.user_id;
      const u = userMap[uid];
      return {
        review_id: r.review_id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer: {
          name: u ? `${u.Fname || ''} ${u.Lname || ''}`.trim() || 'Buyer' : 'Buyer',
          avatar: u?.Avatar || null
        },
        product_name: r.products_id ? (productMap[r.products_id] || null) : null
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

import { supabase } from '../config/supabase.js';
import {
  getSubscriptionPlanFee,
  getValueAddedServiceFee,
  PREMIUM_SELLER_MONTHLY_FEES,
  VALUE_ADDED_SERVICE_FEES
} from '../services/revenueService.js';

// Fetch all sellers
export const getAllSellers = async (req, res) => {
  try {
    const { data, error } = await supabase.from('Seller').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch seller by seller_id
export const getSellerById = async (req, res) => {
  try {
    const { seller_id } = req.params;

    const [
      { data, error },
      { count: followerCount },
      { data: reviews },
      { count: salesCount },
    ] = await Promise.all([
      supabase
        .from('Seller')
        .select(`
          *,
          User (
            user_id,
            Fname,
            Lname,
            Avatar,
            create_at,
            kyc_status
          )
        `)
        .eq('seller_id', seller_id)
        .single(),
      supabase
        .from('Follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_seller_id', seller_id),
      supabase
        .from('Reviews')
        .select('rating')
        .eq('seller_id', seller_id),
      supabase
        .from('Orders')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', seller_id)
        .eq('status', 'completed'),
    ]);

    if (error) return res.status(404).json({ error: error.message });

    const avgRating = reviews?.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0';

    res.json({
      ...data,
      stats: {
        followerCount: followerCount || 0,
        rating: avgRating,
        reviewCount: reviews?.length || 0,
        salesCount: salesCount || 0,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch seller by user_id (get seller profile for logged-in user)
export const getSellerByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { data, error } = await supabase
      .from('Seller')
      .select('*')
      .eq('user_id', user_id)
      .single();
    if (error) return res.status(404).json({ error: 'Seller profile not found for this user' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new seller (open a shop)
export const createSeller = async (req, res) => {
  try {
    const { store_name, business_category, store_handle, store_description, user_id } = req.body;

    // Validation
    if (!store_name || !user_id) {
      return res.status(400).json({ error: 'store_name and user_id are required.' });
    }

    // Check if user already has a seller profile
    const { data: existingSeller, error: checkError } = await supabase
      .from('Seller')
      .select('seller_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (checkError) return res.status(500).json({ error: checkError.message });
    if (existingSeller) {
      return res.status(409).json({ error: 'This user already has a seller account.' });
    }

    const { data, error } = await supabase
      .from('Seller')
      .insert([
        {
          store_name,
          business_category: business_category || null,
          store_handle: store_handle || null,
          store_description: store_description || null,
          user_id,
        }
      ])
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Seller account created successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update seller
export const updateSeller = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { store_name, business_category, store_handle, store_description, logo_url, banner_url } = req.body;

    const updatePayload = {
      ...(store_name && { store_name }),
      ...(business_category !== undefined && { business_category }),
      ...(store_handle !== undefined && { store_handle }),
      ...(store_description !== undefined && { store_description }),
      // null explicitly clears the field; undefined means not sent — skip it
      ...(logo_url !== undefined && { logo_url }),
      ...(banner_url !== undefined && { banner_url }),
    };

    const { data, error } = await supabase
      .from('Seller')
      .update(updatePayload)
      .eq('seller_id', seller_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    res.json({ message: 'Seller updated successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete seller (hard delete)
export const deleteSeller = async (req, res) => {
  try {
    const { seller_id } = req.params;

    const { data, error } = await supabase
      .from('Seller')
      .delete()
      .eq('seller_id', seller_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });;
    }
    res.json({ message: 'Seller account deleted successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSellerRevenueProducts = async (req, res) => {
  try {
    const { seller_id } = req.params;

    const [{ data: subscriptions, error: subError }, { data: services, error: serviceError }] = await Promise.all([
      supabase
        .from('Seller_Subscriptions')
        .select('*')
        .eq('seller_id', seller_id)
        .order('started_at', { ascending: false }),
      supabase
        .from('Value_Added_Earnings')
        .select('*')
        .eq('seller_id', seller_id)
        .order('created_at', { ascending: false })
        .limit(25)
    ]);

    if (subError && subError.code === '42P01') {
      return res.status(501).json({ error: 'Revenue tables are not installed. Run backend/migrations/add_platform_earnings.sql first.' });
    }
    if (subError) throw subError;
    if (serviceError && serviceError.code !== '42P01') throw serviceError;

    res.json({
      plans: [
        {
          plan: 'growth',
          name: 'Growth',
          monthly_fee: PREMIUM_SELLER_MONTHLY_FEES.growth,
          features: ['Advanced analytics', 'Reduced commission rates', 'Priority support']
        },
        {
          plan: 'pro',
          name: 'Pro',
          monthly_fee: PREMIUM_SELLER_MONTHLY_FEES.pro,
          features: ['Everything in Growth', 'Bulk listing tools', 'Highest seller support priority']
        }
      ],
      services: [
        { service_type: 'featured_listing', name: 'Featured Listing', amount: VALUE_ADDED_SERVICE_FEES.featured_listing, description: 'Boost one listing in marketplace discovery.' },
        { service_type: 'highlighted_auction', name: 'Highlighted Auction', amount: VALUE_ADDED_SERVICE_FEES.highlighted_auction, description: 'Notify followers and mark an upcoming auction as promoted.' },
        { service_type: 'shipping_label_generation', name: 'Shipping Label', amount: VALUE_ADDED_SERVICE_FEES.shipping_label_generation, description: 'Generate a printable fulfillment label.' },
        { service_type: 'seller_training_workshop', name: 'Seller Training', amount: VALUE_ADDED_SERVICE_FEES.seller_training_workshop, description: 'Access a guided selling and live auction workshop.' }
      ],
      active_subscription: (subscriptions || []).find(row => row.status === 'active') || null,
      subscription_history: subscriptions || [],
      service_history: services || []
    });
  } catch (err) {
    console.error('getSellerRevenueProducts error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const activateSellerSubscription = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { plan, payment_method = 'manual' } = req.body;
    const monthlyFee = getSubscriptionPlanFee(plan);

    if (!monthlyFee) return res.status(400).json({ error: 'Invalid subscription plan' });

    const { error: cancelError } = await supabase
      .from('Seller_Subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('seller_id', seller_id)
      .eq('status', 'active');

    if (cancelError && cancelError.code === '42P01') {
      return res.status(501).json({ error: 'Revenue tables are not installed. Run backend/migrations/add_platform_earnings.sql first.' });
    }
    if (cancelError) throw cancelError;

    const { data, error } = await supabase
      .from('Seller_Subscriptions')
      .insert([{
        seller_id,
        plan: String(plan).toLowerCase(),
        monthly_fee: monthlyFee,
        status: 'active'
      }])
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: `${data.plan} plan activated`,
      payment_method,
      subscription: data
    });
  } catch (err) {
    console.error('activateSellerSubscription error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const cancelSellerSubscription = async (req, res) => {
  try {
    const { seller_id } = req.params;

    const { data, error } = await supabase
      .from('Seller_Subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('seller_id', seller_id)
      .eq('status', 'active')
      .select('*');

    if (error) throw error;
    res.json({ success: true, cancelled: data?.length || 0 });
  } catch (err) {
    console.error('cancelSellerSubscription error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const purchaseValueAddedService = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { service_type, order_id = null, insured_amount = 0, payment_method = 'manual' } = req.body;
    const amount = getValueAddedServiceFee({ serviceType: service_type, insuredAmount: insured_amount });

    if (!amount) return res.status(400).json({ error: 'Invalid value-added service' });

    const { data, error } = await supabase
      .from('Value_Added_Earnings')
      .insert([{
        seller_id,
        order_id,
        service_type,
        amount
      }])
      .select('*')
      .single();

    if (error && error.code === '42P01') {
      return res.status(501).json({ error: 'Revenue tables are not installed. Run backend/migrations/add_platform_earnings.sql first.' });
    }
    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Service activated',
      payment_method,
      service: data
    });
  } catch (err) {
    console.error('purchaseValueAddedService error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Upload seller store logo
export const uploadStoreLogo = async (req, res) => {
  try {
    const { seller_id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `${seller_id}-${timestamp}-${req.file.originalname}`;
    const filePath = `logos/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('seller-assets')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('seller-assets')
      .getPublicUrl(filePath);

    const logoUrl = urlData.publicUrl;

    // Update seller with logo URL
    const { data: updatedSeller, error: updateError } = await supabase
      .from('Seller')
      .update({ logo_url: logoUrl })
      .eq('seller_id', seller_id)
      .select('*');

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      success: true,
      logoUrl,
      seller: updatedSeller[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Upload seller store banner
export const uploadStoreBanner = async (req, res) => {
  try {
    const { seller_id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `${seller_id}-${timestamp}-${req.file.originalname}`;
    const filePath = `banners/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('seller-assets')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('seller-assets')
      .getPublicUrl(filePath);

    const bannerUrl = urlData.publicUrl;

    // Update seller with banner URL
    const { data: updatedSeller, error: updateError } = await supabase
      .from('Seller')
      .update({ banner_url: bannerUrl })
      .eq('seller_id', seller_id)
      .select('*');

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      success: true,
      bannerUrl,
      seller: updatedSeller[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

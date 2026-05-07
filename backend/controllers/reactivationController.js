import { supabase } from '../config/supabase.js';
import multer from 'multer';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPG, PNG, and PDF files are allowed'));
  },
});

// POST /api/reactivation/upload-id
export const uploadIdDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const filePath = `id-documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('id-documents')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: urlData } = supabase.storage.from('id-documents').getPublicUrl(filePath);
    res.json({ url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/reactivation/request
export const submitReactivationRequest = async (req, res) => {
  try {
    const { email, id_document_url, user_message } = req.body;
    if (!email || !id_document_url) {
      return res.status(400).json({ error: 'Email and ID document are required' });
    }

    const { data: user } = await supabase
      .from('User')
      .select('user_id, role, Fname, Lname')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!user) return res.status(404).json({ error: 'No account found with this email address' });
    if (user.role !== 'Banned') return res.status(400).json({ error: 'This account is not blacklisted' });

    // Block if already has a pending request
    const { data: existing } = await supabase
      .from('Reactivation_Requests')
      .select('id')
      .eq('user_id', user.user_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'A reactivation request is already pending for this account' });
    }

    const { data: request, error: insertErr } = await supabase
      .from('Reactivation_Requests')
      .insert([{
        user_id: user.user_id,
        email: email.toLowerCase().trim(),
        id_document_url,
        user_message: user_message?.trim() || null,
        status: 'pending',
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Notify admin (fire-and-forget)
    supabase.from('Admin_Notifications').insert([{
      type: 'reactivation_request',
      title: 'New Reactivation Request',
      message: `${user.Fname} ${user.Lname} (${email}) has submitted an account reactivation request.`,
      metadata: { user_id: user.user_id, email, request_id: request.id },
    }]).then(() => {}).catch(() => {});

    res.status(201).json({ success: true, request_id: request.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/reactivation/status?email=...
export const getReactivationStatus = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { data: user } = await supabase
      .from('User')
      .select('user_id, role, Fname, Lname')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!user) return res.json({ status: 'not_found' });
    if (user.role !== 'Banned') return res.json({ status: 'not_banned' });

    const { data: request } = await supabase
      .from('Reactivation_Requests')
      .select('id, status, admin_notes, created_at, reviewed_at')
      .eq('user_id', user.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const name = `${user.Fname} ${user.Lname}`;
    if (!request) return res.json({ status: 'no_request', name });

    res.json({
      status: request.status,
      admin_notes: request.admin_notes,
      created_at: request.created_at,
      reviewed_at: request.reviewed_at,
      request_id: request.id,
      name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin ────────────────────────────────────────────────────────────────────

export const getAdminReactivationRequests = async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('Reactivation_Requests')
      .select('id, email, status, id_document_url, user_message, admin_notes, created_at, reviewed_at, user_id')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    let userMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('User')
        .select('user_id, Fname, Lname')
        .in('user_id', userIds);
      if (users) users.forEach(u => { userMap[u.user_id] = `${u.Fname} ${u.Lname}`; });
    }

    res.json(requests.map(r => ({ ...r, user_name: userMap[r.user_id] || r.email })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function wipeAccountData(uid) {
  // ── Seller data ─────────────────────────────────────────────────────────
  const { data: seller } = await supabase.from('Seller').select('seller_id').eq('user_id', uid).maybeSingle();
  if (seller) {
    const sid = seller.seller_id;
    const { data: products } = await supabase.from('Products').select('products_id').eq('seller_id', sid);
    const productIds = products?.map(p => p.products_id) || [];

    if (productIds.length > 0) {
      const { data: auctions } = await supabase.from('Auctions').select('auction_id').in('products_id', productIds);
      const auctionIds = auctions?.map(a => a.auction_id) || [];

      if (auctionIds.length > 0) {
        await supabase.from('Bids').delete().in('auction_id', auctionIds);
        try { await supabase.from('Live_Comments').delete().in('auction_id', auctionIds); } catch {}

        const { data: aOrders } = await supabase.from('Orders').select('order_id').in('auction_id', auctionIds);
        const aOrderIds = aOrders?.map(o => o.order_id) || [];
        if (aOrderIds.length > 0) {
          await supabase.from('Reviews').delete().in('order_id', aOrderIds);
          try { await supabase.from('Order_items').delete().in('order_id', aOrderIds); } catch {}
          await supabase.from('Orders').delete().in('order_id', aOrderIds);
        }
        await supabase.from('Auctions').delete().in('auction_id', auctionIds);
      }
      await supabase.from('Products').delete().in('products_id', productIds);
    }

    await supabase.from('Reviews').delete().eq('seller_id', sid);
    await supabase.from('Seller').delete().eq('seller_id', sid);
  }

  // ── Buyer / shared data ─────────────────────────────────────────────────
  const { data: bOrders } = await supabase.from('Orders').select('order_id').eq('user_id', uid);
  const bOrderIds = bOrders?.map(o => o.order_id) || [];
  if (bOrderIds.length > 0) {
    await supabase.from('Reviews').delete().in('order_id', bOrderIds);
    try { await supabase.from('Order_items').delete().in('order_id', bOrderIds); } catch {}
  }
  await supabase.from('Orders').delete().eq('user_id', uid);
  await supabase.from('Bids').delete().eq('user_id', uid);
  await supabase.from('Reviews').delete().or(`user_id.eq.${uid},reviewers_id.eq.${uid}`);
  await supabase.from('Notifications').delete().eq('user_id', uid);
  try { await supabase.from('Live_Comments').delete().eq('user_id', uid); } catch {}
  try { await supabase.from('Disputes').delete().eq('reporter_id', uid); } catch {}
  try { await supabase.from('Wishlist').delete().eq('user_id', uid); } catch {}
  try { await supabase.from('Follows').delete().eq('follower_id', uid); } catch {}
  try { await supabase.from('Cart').delete().eq('user_id', uid); } catch {}

  // ── Reset violation record ───────────────────────────────────────────────
  await supabase.from('Violation_Records').update({
    standing: 'Active',
    account_status: 'clean',
    strike_count: 0,
    suspension_expires_at: null,
    suspension_reason: null,
  }).eq('user_id', uid);

  // ── Reset user account ───────────────────────────────────────────────────
  await supabase.from('User').update({
    role: 'Buyer',
    is_verified: false,
    kyc_status: null,
  }).eq('user_id', uid);
}

export const approveReactivationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const { data: request, error: fetchErr } = await supabase
      .from('Reactivation_Requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

    await wipeAccountData(request.user_id);

    await supabase.from('Reactivation_Requests').update({
      status: 'approved',
      admin_notes: notes?.trim() || 'Your account has been reactivated. You may now log in and start fresh.',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    console.log(`[Reactivation] Approved user ${request.user_id} (${request.email}). Full data wipe complete.`);
    res.json({ success: true, message: 'Account reactivated and data wiped' });
  } catch (err) {
    console.error('approveReactivationRequest error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const rejectReactivationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const { data: request, error: fetchErr } = await supabase
      .from('Reactivation_Requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

    await supabase.from('Reactivation_Requests').update({
      status: 'rejected',
      admin_notes: notes?.trim() || 'Your reactivation request has been denied.',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    res.json({ success: true, message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

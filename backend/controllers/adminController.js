import { supabase } from '../config/supabase.js';

/**
 * Admin Controller
 * Handles administrative actions for platform oversight
 */

// 1. Get stats for Admin Dashboard
export const getAdminDashboardStats = async (req, res) => {
    try {
        const [
            { count: pendingKyc },
            { count: flaggedListings },
            { count: openDisputes },
            { count: suspendedUsers }
        ] = await Promise.all([
            supabase
                .from('User')
                .select('*', { count: 'exact', head: true })
                .eq('kyc_status', 'pending'),
            supabase
                .from('Products')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'under_review'),
            supabase
                .from('Disputes')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'open'),
            supabase
                .from('Violation_Records')
                .select('*', { count: 'exact', head: true })
                .eq('standing', 'Suspended')
        ]);

        res.json({
            pendingKyc: pendingKyc || 0,
            flaggedListings: flaggedListings || 0,
            openDisputes: openDisputes || 0,
            suspendedUsers: suspendedUsers || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2. KYC Management
export const getKycPendingUsers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('User')
            .select('user_id, Fname, Lname, email, create_at, contact_num, is_verified, kyc_status')
            .eq('kyc_status', 'pending')
            .order('create_at', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const updateKycStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body; // status: approved, probated, rejected

        const { data, error } = await supabase
            .from('User')
            .update({ 
                kyc_status: status,
                is_verified: status === 'approved'
            })
            .eq('user_id', id)
            .select()
            .single();

        if (error) throw error;

        // Notify user
        await supabase.from('Notifications').insert([{
            user_id: id,
            type: 'system',
            title: `KYC Review: ${status.toUpperCase()}`,
            message: note || `Your identity verification has been ${status}.`
        }]);

        res.json({ message: 'KYC status updated', user: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const STANDING_TO_STATUS = {
    Active:       'clean',
    Probationary: 'warned',
    Suspended:    'restricted',
    Blacklisted:  'suspended',
};

// 3. User Standing Management
export const updateUserStanding = async (req, res) => {
    try {
        const { id } = req.params;
        const { standing, reason, suspensionDays, suspensionUntil } = req.body;

        const account_status = STANDING_TO_STATUS[standing];
        if (!account_status) {
            return res.status(400).json({ error: `Invalid standing: ${standing}` });
        }

        const updatePayload = { account_status };

        if (standing === 'Suspended') {
            let expires = null;
            if (suspensionUntil) {
                expires = new Date(suspensionUntil);
            } else if (suspensionDays) {
                expires = new Date();
                expires.setDate(expires.getDate() + parseInt(suspensionDays, 10));
            }
            updatePayload.suspension_expires_at = expires ? expires.toISOString() : null;
            updatePayload.suspension_reason = reason || null;
        } else {
            updatePayload.suspension_expires_at = null;
            updatePayload.suspension_reason = null;
        }

        // Upsert violation record
        const { data: existing } = await supabase
            .from('Violation_Records')
            .select('user_id')
            .eq('user_id', id)
            .maybeSingle();

        let record, dbError;
        if (existing) {
            ({ data: record, error: dbError } = await supabase
                .from('Violation_Records')
                .update(updatePayload)
                .eq('user_id', id)
                .select()
                .single());
        } else {
            ({ data: record, error: dbError } = await supabase
                .from('Violation_Records')
                .insert([{ user_id: id, strike_count: 0, ...updatePayload }])
                .select()
                .single());
        }

        if (dbError) throw dbError;

        // Sync User.role for blacklist / reinstate
        if (standing === 'Blacklisted') {
            await supabase.from('User').update({ role: 'Banned' }).eq('user_id', id);
        } else {
            const { data: userData } = await supabase.from('User').select('role').eq('user_id', id).single();
            if (userData?.role === 'Banned') {
                await supabase.from('User').update({ role: 'Buyer' }).eq('user_id', id);
            }
        }

        // Notify user
        const daysLabel = updatePayload.suspension_expires_at
            ? ` for ${suspensionDays ? `${suspensionDays} day(s)` : 'a set period'}`
            : '';
        const notifMap = {
            Active:       { title: 'Account Restored',          message: 'Your account has been restored to Active status. Welcome back!' },
            Probationary: { title: 'Account Warning: Probation', message: `Your account is now on Probation.${reason ? ` Reason: ${reason}.` : ' Please review our community guidelines to avoid further action.'}` },
            Suspended:    { title: 'Account Suspended',          message: `Your account has been temporarily suspended${daysLabel}.${reason ? ` Reason: ${reason}.` : ''}` },
            Blacklisted:  { title: 'Account Permanently Banned', message: 'Your account has been permanently banned due to a violation of our terms of service.' },
        };
        await supabase.from('Notifications').insert([{
            user_id: id,
            type: 'system',
            title: notifMap[standing].title,
            message: notifMap[standing].message,
        }]);

        console.log(`Admin ${req.user.user_id} set user ${id} to ${standing}. Reason: ${reason || 'none'}`);
        res.json({ message: 'User standing updated', record });
    } catch (err) {
        console.error('updateUserStanding error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 4. Listing Moderation
export const getFlaggedListings = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Products')
            .select('*, Seller(store_name)')
            .eq('status', 'under_review');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const moderateListing = async (req, res) => {
    try {
        const { id } = req.params; // products_id
        const { action, note } = req.body; // approve, reject, revise

        let newStatus = 'active';
        if (action === 'reject') newStatus = 'rejected';
        if (action === 'revise') newStatus = 'draft';

        const { data, error } = await supabase
            .from('Products')
            .update({ status: newStatus })
            .eq('products_id', id)
            .select()
            .single();

        if (error) throw error;

        // Notification logic...
        
        res.json({ message: `Listing ${action}ed`, product: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 5. Dispute Resolution
export const getDisputes = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Disputes')
            .select('*, User!reporter_id(Fname, Lname), Orders(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution, notes } = req.body; // refund, escrow_release, partial_settlement

        const { data, error } = await supabase
            .from('Disputes')
            .update({ 
                status: 'resolved',
                resolution_type: resolution,
                moderator_notes: notes,
                resolved_at: new Date()
            })
            .eq('dispute_id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Dispute resolved', dispute: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── Admin Notifications ──────────────────────────────────────────────────────

export const getAdminNotifications = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Admin_Notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const markAdminNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('Admin_Notifications')
            .update({ is_read: true })
            .eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const markAllAdminNotificationsRead = async (req, res) => {
    try {
        const { error } = await supabase
            .from('Admin_Notifications')
            .update({ is_read: true })
            .eq('is_read', false);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

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

// 3. User Standing Management
export const updateUserStanding = async (req, res) => {
    try {
        const { id } = req.params; // user_id
        const { standing, reason } = req.body; // Active, Probationary, Suspended, Blacklisted

        const { data, error } = await supabase
            .from('Violation_Records')
            .update({ standing })
            .eq('user_id', id)
            .select()
            .single();

        if (error) throw error;

        // If blacklisted, update user status as well if needed
        if (standing === 'Blacklisted') {
            await supabase.from('User').update({ role: 'Banned' }).eq('user_id', id);
        }

        // Log the action (planned Audit_Logs)
        console.log(`Admin ${req.user.user_id} updated user ${id} standing to ${standing}. Reason: ${reason}`);

        res.json({ message: 'User standing updated', record: data });
    } catch (err) {
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

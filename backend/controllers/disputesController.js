import { supabase } from '../config/supabase.js';

export const createDispute = async (req, res) => {
    try {
        const reporter_id = req.user?.user_id;
        if (!reporter_id) return res.status(401).json({ error: 'Unauthorized' });

        const { reported_user_id, reported_user_name, context, reason, details } = req.body;
        if (!reason) return res.status(400).json({ error: 'Reason is required' });

        const reasonText = [
            `Context: ${context || 'User Report'}`,
            reported_user_name ? `Reported User: ${reported_user_name}` : null,
            reported_user_id ? `Reported User ID: ${reported_user_id}` : null,
            `Reason: ${reason}`,
            details ? `Details: ${details}` : null,
        ].filter(Boolean).join(' | ');

        const { data, error } = await supabase
            .from('Disputes')
            .insert([{
                reporter_id,
                order_id: null,
                reason: reasonText,
                status: 'open',
            }])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, dispute: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

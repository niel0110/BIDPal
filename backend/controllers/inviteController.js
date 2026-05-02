import crypto from 'crypto';
import { supabase } from '../config/supabase.js';

const getFrontendOrigin = (req) => {
  const requestedOrigin = String(req.query.origin || '').trim();
  const configuredOrigin = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://bidpal.shop';
  const origin = requestedOrigin || configuredOrigin;

  try {
    const parsed = new URL(origin);
    const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    if (isLocal) return configuredOrigin.replace(/\/+$/, '');
  } catch {
    return configuredOrigin.replace(/\/+$/, '');
  }

  return origin.replace(/\/+$/, '');
};

const buildInviteCode = (userId) => {
  const secret = process.env.JWT_SECRET || 'bidpal-invite';
  const digest = crypto
    .createHash('sha256')
    .update(`${userId}:${secret}`)
    .digest('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10)
    .toUpperCase();

  return `BP${digest}`;
};

const getReferralCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('Referrals')
      .select('referral_id', { count: 'exact', head: true })
      .eq('referrer_user_id', userId);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
};

const saveInviteCode = async (userId, inviteCode) => {
  try {
    await supabase
      .from('Invite_Codes')
      .upsert(
        {
          invite_code: inviteCode,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'invite_code' }
      );
  } catch {
    // Deployments without referral tables can still generate usable invite links.
  }
};

export const getMyInvite = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User authentication required' });

    const inviteCode = buildInviteCode(userId);
    await saveInviteCode(userId, inviteCode);
    const origin = getFrontendOrigin(req);
    const inviteLink = `${origin}/signup?ref=${encodeURIComponent(inviteCode)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=18&data=${encodeURIComponent(inviteLink)}`;
    const acceptedInvites = await getReferralCount(userId);

    res.json({
      inviteCode,
      inviteLink,
      qrCodeUrl,
      acceptedInvites,
      rewardLabel: 'Rewards unlock when friends create and verify an account.',
    });
  } catch (err) {
    console.error('Invite generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate invite link' });
  }
};

export default { getMyInvite };

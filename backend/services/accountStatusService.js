import { supabase } from '../config/supabase.js';

const daysUntil = (date) => Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));

export const getUserAccountStatus = async (userId) => {
  const { data: user, error: userError } = await supabase
    .from('User')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) return { exists: false, accountStatus: null };

  if (user.role === 'Banned') {
    return {
      exists: true,
      accountStatus: {
        status: 'banned',
        reason: 'Your account has been permanently blacklisted.',
      },
    };
  }

  const { data: record, error: recordError } = await supabase
    .from('Violation_Records')
    .select('account_status, suspension_expires_at, suspension_reason')
    .eq('user_id', userId)
    .maybeSingle();

  if (recordError) throw recordError;
  if (!record?.account_status || record.account_status === 'clean') {
    return { exists: true, accountStatus: null };
  }

  if (record.account_status === 'suspended') {
    return {
      exists: true,
      accountStatus: {
        status: 'banned',
        reason: record.suspension_reason || 'Your account has been permanently blacklisted.',
      },
    };
  }

  if (record.account_status === 'restricted') {
    const expiresAt = record.suspension_expires_at;
    if (expiresAt) {
      const expiry = new Date(expiresAt);
      if (new Date() >= expiry) {
        await supabase
          .from('Violation_Records')
          .update({
            account_status: 'clean',
            suspension_expires_at: null,
            suspension_reason: null,
          })
          .eq('user_id', userId);
        return { exists: true, accountStatus: null };
      }

      return {
        exists: true,
        accountStatus: {
          status: 'suspended',
          daysRemaining: daysUntil(expiry),
          expiresAt,
          reason: record.suspension_reason || null,
        },
      };
    }

    return {
      exists: true,
      accountStatus: {
        status: 'suspended',
        daysRemaining: null,
        expiresAt: null,
        reason: record.suspension_reason || null,
      },
    };
  }

  if (record.account_status === 'warned') {
    return { exists: true, accountStatus: { status: 'probation' } };
  }

  return { exists: true, accountStatus: null };
};

export const assertCanCheckout = async (userId) => {
  const { exists, accountStatus } = await getUserAccountStatus(userId);

  if (!exists) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  if (accountStatus?.status === 'banned') {
    const err = new Error('This account is blacklisted and cannot place orders.');
    err.statusCode = 403;
    err.code = 'ACCOUNT_BANNED';
    err.accountStatus = accountStatus;
    throw err;
  }

  if (accountStatus?.status === 'suspended') {
    const untilText = accountStatus.expiresAt
      ? ` until ${new Date(accountStatus.expiresAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`
      : '';
    const err = new Error(`This account is suspended${untilText}. Checkout and payment are disabled during suspension.`);
    err.statusCode = 403;
    err.code = 'ACCOUNT_SUSPENDED';
    err.accountStatus = accountStatus;
    throw err;
  }

  return true;
};

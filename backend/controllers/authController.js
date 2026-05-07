
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { getEmailServiceStatus, isEmailConfigured, sendEmail, sendVerificationCodeEmail } from '../services/emailService.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const verificationCodes = new Map();
const verifiedTokens = new Map();
const isProduction = process.env.NODE_ENV === 'production';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const codeKey = (purpose, email) => `${purpose}:${normalizeEmail(email)}`;
const generateCode = () => String(crypto.randomInt(100000, 1000000));
const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const generateToken = () => crypto.randomBytes(32).toString('hex');

const cleanupExpiredAuthCodes = () => {
  const now = Date.now();
  for (const [key, value] of verificationCodes.entries()) {
    if (value.expiresAt <= now) verificationCodes.delete(key);
  }
  for (const [key, value] of verifiedTokens.entries()) {
    if (value.expiresAt <= now) verifiedTokens.delete(key);
  }
};

const findUserByEmail = async (email, columns = 'user_id, email') => {
  return supabase
    .from('User')
    .select(columns)
    .ilike('email', normalizeEmail(email))
    .maybeSingle();
};

const consumeVerifiedToken = (purpose, email, token) => {
  cleanupExpiredAuthCodes();
  const key = codeKey(purpose, email);
  const entry = verifiedTokens.get(key);
  if (!entry || entry.token !== token || entry.expiresAt <= Date.now()) return false;
  verifiedTokens.delete(key);
  return true;
};

export const sendEmailVerificationCode = async (req, res) => {
  cleanupExpiredAuthCodes();
  const email = normalizeEmail(req.body.email);
  const purpose = req.body.purpose === 'forgot-password' ? 'forgot-password' : 'register';

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    if (purpose === 'forgot-password' || purpose === 'register') {
      const { data: existingUser, error } = await findUserByEmail(email);

      if (error) {
        console.error('Email verification user lookup failed:', error);
        return res.status(503).json({
          error: 'Account lookup is temporarily unavailable. Please try again.',
          code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
        });
      }

      if (purpose === 'forgot-password' && !existingUser) {
        return res.status(404).json({ error: 'No BIDPal account exists for this email.' });
      }

      if (purpose === 'register' && existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.', code: 'EMAIL_ALREADY_REGISTERED' });
      }
    }

    const code = generateCode();
    verificationCodes.set(codeKey(purpose, email), {
      codeHash: hashValue(code),
      attempts: 0,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    if (isEmailConfigured()) {
      try {
        await sendVerificationCodeEmail({ email, code, purpose });
        return res.json({ message: 'Verification code sent.' });
      } catch (mailError) {
        console.error('Email delivery failed:', mailError);

        return res.status(502).json({
          error: mailError.code === 'EMAIL_AUTH_FAILED'
            ? 'Resend rejected the email API key or sender. Check RESEND_API_KEY and RESEND_FROM.'
            : mailError.code === 'EMAIL_API_FAILED'
              ? 'Resend could not send this email. Check the sender address/domain in your deployed email settings.'
              : 'Unable to send verification email. Please try again later.',
          code: mailError.code || 'EMAIL_SEND_FAILED',
          ...(!isProduction ? {
            debug: mailError.cause?.message || mailError.message,
            debugCode: mailError.cause?.code || null,
          } : {}),
        });
      }
    }

    if (isProduction) {
      return res.status(503).json({
        error: 'Email service is not configured on the deployed backend. Add RESEND_API_KEY and RESEND_FROM, then redeploy.',
      });
    }

    return res.status(503).json({
      error: 'Email service is not configured. Add RESEND_API_KEY and RESEND_FROM, then restart the backend.',
      code: 'EMAIL_NOT_CONFIGURED',
    });
  } catch (err) {
    console.error('Error sending verification code:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification code.' });
  }
};

export const getEmailStatus = async (req, res) => {
  const status = getEmailServiceStatus();
  res.json({
    ...status,
    environment: process.env.NODE_ENV || 'development',
  });
};

export const sendTestEmail = async (req, res) => {
  if (isProduction) {
    const expectedSecret = process.env.EMAIL_TEST_SECRET;
    const providedSecret = req.get('x-email-test-secret');

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return res.status(403).json({ error: 'Email test endpoint is locked in production.' });
    }
  }

  const to = normalizeEmail(req.body.to);
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();

  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'To, subject, and message are required.' });
  }

  try {
    await sendEmail({
      to,
      subject,
      text: message,
      html: `<p>${message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />')}</p>`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Test email failed:', err);
    res.status(400).json({
      error: err.message || 'Unable to send test email.',
      code: err.code || 'EMAIL_SEND_FAILED',
    });
  }
};

export const verifyEmailCode = async (req, res) => {
  cleanupExpiredAuthCodes();
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const purpose = req.body.purpose === 'forgot-password' ? 'forgot-password' : 'register';
  const key = codeKey(purpose, email);
  const entry = verificationCodes.get(key);

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  if (!entry || entry.expiresAt <= Date.now()) {
    verificationCodes.delete(key);
    return res.status(400).json({
      error: 'Verification code expired. Please request a new code.',
      code: 'CODE_EXPIRED',
    });
  }

  if (entry.attempts >= 5) {
    verificationCodes.delete(key);
    return res.status(429).json({
      error: 'Too many incorrect attempts. Please request a new code.',
      code: 'TOO_MANY_ATTEMPTS',
    });
  }

  if (entry.codeHash !== hashValue(code)) {
    entry.attempts += 1;
    return res.status(400).json({
      error: 'Verification code is incorrect. Please check the latest email code or request a new one.',
      code: 'INVALID_CODE',
    });
  }

  verificationCodes.delete(key);
  const token = generateToken();
  verifiedTokens.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS });

  res.json({
    message: 'Email verified successfully.',
    token,
    tokenName: purpose === 'forgot-password' ? 'resetToken' : 'emailVerificationToken',
  });
};

// Register user (sign up)
export const register = async (req, res) => {
  const { password, Fname, Mname, Lname, role, contact_num, Avatar, emailVerificationToken, referralCode } = req.body;
  const email = normalizeEmail(req.body.email);
  console.log('Register request received:', { email, role });
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!consumeVerifiedToken('register', email, emailVerificationToken)) {
    return res.status(400).json({ error: 'Please verify your email before creating an account.' });
  }

  try {
    console.log('Checking for existing user...');
    // Check if user already exists
    const { data: existingUser, error: findError } = await findUserByEmail(email, 'user_id');

    if (findError) {
      console.error('Supabase find error:', findError);
      return res.status(500).json({ error: findError.message });
    }

    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(409).json({ error: 'User already exists.' });
    }

    console.log('Hashing password...');
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Inserting new user...');
    // Insert new user with all provided fields
    const { data, error } = await supabase
      .from('User')
      .insert([{ email, password: hashedPassword, Fname, Mname, Lname, role, contact_num, Avatar }])
      .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar, is_verified, kyc_status');

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      console.error('No data returned after insert');
      return res.status(500).json({ error: 'Failed to create user record.' });
    }

    console.log('User created successfully, generating token...');

    // Notify admin — fire-and-forget, never blocks registration
    const newUser = data[0];
    const fullName = [Fname, Lname].filter(Boolean).join(' ') || 'Unknown';
    supabase.from('Admin_Notifications').insert([{
      type: 'new_user',
      title: 'New User Registered',
      message: `${fullName} (${email}) just created a ${newUser.role || 'Buyer'} account.`,
      metadata: {
        user_id: newUser.user_id,
        email: newUser.email,
        name: fullName,
        role: newUser.role || 'Buyer',
      },
    }]).then(() => {}).catch(() => {});

    if (referralCode) {
      try {
        const normalizedInvite = String(referralCode).trim().toUpperCase();
        const { data: invite } = await supabase
          .from('Invite_Codes')
          .select('user_id, invite_code')
          .eq('invite_code', normalizedInvite)
          .maybeSingle();

        if (invite?.user_id && invite.user_id !== data[0].user_id) {
          await supabase
            .from('Referrals')
            .insert([{
              referrer_user_id: invite.user_id,
              referred_user_id: data[0].user_id,
              invite_code: invite.invite_code,
              status: 'signed_up'
            }]);
        }
      } catch {
        // Referral recording is best-effort and should not block account creation.
      }
    }

    // Generate JWT
    const token = jwt.sign({ user_id: data[0].user_id, email: data[0].email, role: data[0].role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ message: 'User registered successfully', user: data[0], token });
  } catch (err) {
    console.error('Unexpected error in register controller:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};

export const resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { resetToken, newPassword } = req.body;

  if (!email || !resetToken || !newPassword) {
    return res.status(400).json({ error: 'Email, reset token, and new password are required.' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  if (!consumeVerifiedToken('forgot-password', email, resetToken)) {
    return res.status(400).json({ error: 'Password reset session is invalid or expired.' });
  }

  try {
    const { data: existingUser, error: findError } = await findUserByEmail(email, 'user_id');
    if (findError) return res.status(500).json({ error: findError.message });
    if (!existingUser) return res.status(404).json({ error: 'No BIDPal account exists for this email.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from('User')
      .update({ password: hashedPassword })
      .eq('user_id', existingUser.user_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Unexpected error in resetPassword controller:', err);
    res.status(500).json({ error: err.message });
  }
};

// Login user
export const login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  console.log('Login request received:', { email });
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const { data, error } = await supabase
    .from('User')
    .select('user_id, email, password, Fname, Mname, Lname, role, contact_num, Avatar, is_verified, kyc_status')
    .eq('email', email)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) {
    return res.status(404).json({ error: 'User is not registered yet.' });
  }
  const validPassword = await bcrypt.compare(password, data.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // ── Account status gate ──────────────────────────────────────────────────
  // Permanently banned at role level
  if (data.role === 'Banned') {
    return res.json({
      banned: true,
      error: 'account_banned',
      message: 'Your account has been permanently banned due to a violation of our terms.'
    });
  }

  // Fetch violation record (select * so missing columns return undefined, not error)
  const { data: vr } = await supabase
    .from('Violation_Records')
    .select('*')
    .eq('user_id', data.user_id)
    .maybeSingle();

  // Permanently banned at violation level
  if (vr?.account_status === 'suspended') {
    return res.json({
      banned: true,
      error: 'account_banned',
      message: 'Your account has been permanently banned due to a violation of our terms.'
    });
  }

  let accountStatus = null;

  // Temporarily suspended
  if (vr?.account_status === 'restricted') {
    const expiresAt = vr.suspension_expires_at;
    if (expiresAt && new Date() < new Date(expiresAt)) {
      const daysRemaining = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
      accountStatus = { status: 'suspended', daysRemaining, expiresAt, reason: vr.suspension_reason || null };
    } else if (expiresAt && new Date() >= new Date(expiresAt)) {
      // Auto-lift expired suspension
      await supabase.from('Violation_Records')
        .update({ account_status: 'clean', suspension_expires_at: null, suspension_reason: null })
        .eq('user_id', data.user_id);
    } else {
      // No expiry set — indefinite suspension
      accountStatus = { status: 'suspended', daysRemaining: null, expiresAt: null, reason: vr.suspension_reason || null };
    }
  }

  // Probation
  if (!accountStatus && vr?.account_status === 'warned') {
    accountStatus = { status: 'probation' };
  }
  // ────────────────────────────────────────────────────────────────────────

  // Fetch seller_id if user is a seller
  let seller_id = null;
  if (data.role?.toLowerCase() === 'seller') {
    const { data: sellerRow } = await supabase
      .from('Seller')
      .select('seller_id')
      .eq('user_id', data.user_id)
      .maybeSingle();
    seller_id = sellerRow?.seller_id || null;
  }

  // Generate JWT
  const token = jwt.sign({ user_id: data.user_id, email: data.email, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({
    message: 'Login successful',
    user: { user_id: data.user_id, email: data.email, Fname: data.Fname, Mname: data.Mname, Lname: data.Lname, role: data.role, contact_num: data.contact_num, Avatar: data.Avatar, is_verified: data.is_verified, kyc_status: data.kyc_status, seller_id },
    token,
    ...(accountStatus && { accountStatus })
  });
};

// Google OAuth login (with token verification)
export const googleLogin = async (req, res) => {
  console.log('Google login request received');
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required.' });
  }

  try {
    // Initialize Google OAuth2 client
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { given_name, family_name, picture } = payload;
    const email = normalizeEmail(payload.email);

    if (!email) {
      return res.status(400).json({ error: 'Email not found in Google account.' });
    }

    // Check if user already exists
    const { data: existingUser, error: findError } = await supabase
      .from('User')
      .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar, is_verified, kyc_status')
      .eq('email', email)
      .maybeSingle();

    if (findError) {
      console.error('Supabase find error:', findError);
      return res.status(500).json({ error: findError.message });
    }

    let user;
    if (existingUser) {
      console.log('Existing user found for Google login:', email);
      user = existingUser;

      // Update avatar if it changed or was null
      if (picture && (!user.Avatar || user.Avatar !== picture)) {
        await supabase
          .from('User')
          .update({ Avatar: picture })
          .eq('user_id', user.user_id);
        user.Avatar = picture;
      }
    } else {
      console.log('Creating new user for Google login:', email);
      // Create new user
      // Use a random password string since they won't use it for login
      const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);

      const { data, error: insertError } = await supabase
        .from('User')
        .insert([{
          email,
          password: dummyPassword,
          Fname: given_name || '',
          Lname: family_name || '',
          Avatar: picture || null,
          role: 'Buyer'
        }])
        .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar, is_verified, kyc_status')
        .single();

      if (insertError) {
        console.error('Supabase insert error during Google login:', insertError);
        return res.status(400).json({ error: insertError.message });
      }
      user = data;
    }

    // ── Account status gate ──────────────────────────────────────────────
    if (user.role === 'Banned') {
      return res.status(403).json({ error: 'account_banned', message: 'Your account has been permanently banned due to a violation of our terms.' });
    }
    const { data: gvr } = await supabase.from('Violation_Records').select('*').eq('user_id', user.user_id).maybeSingle();
    if (gvr?.account_status === 'suspended') {
      return res.status(403).json({ error: 'account_banned', message: 'Your account has been permanently banned due to a violation of our terms.' });
    }
    let gAccountStatus = null;
    if (gvr?.account_status === 'restricted') {
      const expiresAt = gvr.suspension_expires_at;
      if (expiresAt && new Date() < new Date(expiresAt)) {
        const daysRemaining = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
        gAccountStatus = { status: 'suspended', daysRemaining, expiresAt, reason: gvr.suspension_reason || null };
      } else if (expiresAt) {
        await supabase.from('Violation_Records').update({ account_status: 'clean', suspension_expires_at: null, suspension_reason: null }).eq('user_id', user.user_id);
      } else {
        gAccountStatus = { status: 'suspended', daysRemaining: null, expiresAt: null, reason: gvr.suspension_reason || null };
      }
    }
    if (!gAccountStatus && gvr?.account_status === 'warned') gAccountStatus = { status: 'probation' };
    // ────────────────────────────────────────────────────────────────────

    // Fetch seller_id if user is a seller
    let seller_id = null;
    if (user.role?.toLowerCase() === 'seller') {
      const { data: sellerRow } = await supabase
        .from('Seller')
        .select('seller_id')
        .eq('user_id', user.user_id)
        .maybeSingle();
      seller_id = sellerRow?.seller_id || null;
    }

    // Generate JWT
    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', user: { ...user, seller_id }, token, ...(gAccountStatus && { accountStatus: gAccountStatus }) });
  } catch (err) {
    console.error('Unexpected error in googleLogin controller:', err);
    res.status(500).json({ error: err.message });
  }
};

// Legacy social login (kept for backward compatibility)
export const socialLogin = async (req, res) => {
  console.log('Social login request received:', req.body);
  const { Fname, Lname, Avatar, role } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // Check if user already exists
    const { data: existingUser, error: findError } = await supabase
      .from('User')
      .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar, is_verified, kyc_status')
      .eq('email', email)
      .maybeSingle();

    if (findError) {
      console.error('Supabase find error:', findError);
      return res.status(500).json({ error: findError.message });
    }

    let user;
    if (existingUser) {
      console.log('Existing user found for social login:', email);
      user = existingUser;

      // Update avatar if it changed or was null
      if (Avatar && (!user.Avatar || user.Avatar !== Avatar)) {
        await supabase
          .from('User')
          .update({ Avatar })
          .eq('user_id', user.user_id);
        user.Avatar = Avatar;
      }
    } else {
      console.log('Creating new user for social login:', email);
      // Create new user
      // Use a random password string since they won't use it for login
      const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);

      const { data, error: insertError } = await supabase
        .from('User')
        .insert([{
          email,
          password: dummyPassword,
          Fname,
          Lname,
          Avatar,
          role: role || 'Buyer'
        }])
        .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar, is_verified, kyc_status')
        .single();

      if (insertError) {
        console.error('Supabase insert error during social login:', insertError);
        return res.status(400).json({ error: insertError.message });
      }
      user = data;
    }

    // Fetch seller_id if user is a seller
    let seller_id = null;
    if (user.role?.toLowerCase() === 'seller') {
      const { data: sellerRow } = await supabase
        .from('Seller')
        .select('seller_id')
        .eq('user_id', user.user_id)
        .maybeSingle();
      seller_id = sellerRow?.seller_id || null;
    }

    // Generate JWT
    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', user: { ...user, seller_id }, token });
  } catch (err) {
    console.error('Unexpected error in socialLogin controller:', err);
    res.status(500).json({ error: err.message });
  }
};



import { supabase } from '../config/supabase.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { isEmailConfigured, sendVerificationCodeEmail } from '../services/emailService.js';

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
    if (purpose === 'forgot-password') {
      const { data: existingUser, error } = await findUserByEmail(email);

      if (error) {
        console.error('Email verification user lookup failed:', error);
        return res.status(503).json({
          error: 'Account lookup is temporarily unavailable. Please try again.',
          code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
        });
      }

      if (!existingUser) {
        return res.status(404).json({ error: 'No BIDPal account exists for this email.' });
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

        if (!isProduction && mailError.code === 'EMAIL_AUTH_FAILED') {
          console.log(`[DEV] ${purpose} verification code for ${email}: ${code}`);
          return res.json({
            message: 'Development mode: Gmail rejected the sender login. Use the code shown below, then replace GMAIL_APP_PASSWORD with a Gmail App Password.',
            devCode: code,
          });
        }

        return res.status(502).json({
          error: mailError.code === 'EMAIL_AUTH_FAILED'
            ? 'Gmail rejected the sender credentials. Use a Gmail App Password for the BIDPal sender account.'
            : mailError.code === 'EMAIL_DELIVERY_FAILED'
              ? 'The deployed server cannot reach Gmail SMTP. Try SMTP_PORT=465 and SMTP_SECURE=true, or use an email API provider for production.'
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
        error: 'Email service is not configured on the deployed backend. Add GMAIL_USER and GMAIL_APP_PASSWORD to the backend hosting environment variables, then redeploy.',
      });
    }

    console.log(`[DEV] ${purpose} verification code for ${email}: ${code}`);
    return res.json({
      message: 'Development mode: email service is not configured. Use the code shown below.',
      devCode: code,
    });
  } catch (err) {
    console.error('Error sending verification code:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification code.' });
  }
};

export const getEmailStatus = async (req, res) => {
  res.json({
    configured: isEmailConfigured(),
    provider: process.env.SMTP_HOST ? 'custom-smtp' : 'gmail',
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure: process.env.SMTP_SECURE || 'false',
    hasUser: Boolean(process.env.SMTP_USER || process.env.GMAIL_USER),
    hasPassword: Boolean(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD),
    environment: process.env.NODE_ENV || 'development',
  });
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
  const { password, Fname, Mname, Lname, role, contact_num, Avatar, emailVerificationToken } = req.body;
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
      .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar');

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      console.error('No data returned after insert');
      return res.status(500).json({ error: 'Failed to create user record.' });
    }

    console.log('User created successfully, generating token...');
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
    .select('user_id, email, password, Fname, Mname, Lname, role, contact_num, Avatar')
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
  res.json({ message: 'Login successful', user: { user_id: data.user_id, email: data.email, Fname: data.Fname, Mname: data.Mname, Lname: data.Lname, role: data.role, contact_num: data.contact_num, Avatar: data.Avatar, seller_id }, token });
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
      .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar')
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
        .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar')
        .single();

      if (insertError) {
        console.error('Supabase insert error during Google login:', insertError);
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
      .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar')
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
        .select('user_id, email, Fname, Mname, Lname, role, contact_num, Avatar')
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


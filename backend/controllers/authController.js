
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

// Register user (sign up)
export const register = async (req, res) => {
  console.log('Register request received:', req.body);
  const { email, password, Fname, Mname, Lname, role, contact_num, Avatar } = req.body;
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    console.log('Checking for existing user...');
    // Check if user already exists
    const { data: existingUser, error: findError } = await supabase
      .from('User')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

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
    const token = jwt.sign({ user_id: data[0].user_id, email: data[0].email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ message: 'User registered successfully', user: data[0], token });
  } catch (err) {
    console.error('Unexpected error in register controller:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};

// Login user
export const login = async (req, res) => {
  console.log('Login request received:', req.body);
  const { email, password } = req.body;
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
  const token = jwt.sign({ user_id: data.user_id, email: data.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
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
    const { email, given_name, family_name, picture } = payload;

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
    const token = jwt.sign({ user_id: user.user_id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', user: { ...user, seller_id }, token });
  } catch (err) {
    console.error('Unexpected error in googleLogin controller:', err);
    res.status(500).json({ error: err.message });
  }
};

// Legacy social login (kept for backward compatibility)
export const socialLogin = async (req, res) => {
  console.log('Social login request received:', req.body);
  const { email, Fname, Lname, Avatar, role } = req.body;

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
    const token = jwt.sign({ user_id: user.user_id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', user: { ...user, seller_id }, token });
  } catch (err) {
    console.error('Unexpected error in socialLogin controller:', err);
    res.status(500).json({ error: err.message });
  }
};


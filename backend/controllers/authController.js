
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
  // Generate JWT
  const token = jwt.sign({ user_id: data.user_id, email: data.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ message: 'Login successful', user: { user_id: data.user_id, email: data.email, Fname: data.Fname, Mname: data.Mname, Lname: data.Lname, role: data.role, contact_num: data.contact_num, Avatar: data.Avatar }, token });
};

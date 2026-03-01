
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Register user (sign up)
export const register = async (req, res) => {
  console.log('Register request received:', req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  // Check if user already exists
  const { data: existingUser, error: findError } = await supabase
    .from('User')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();
  if (findError) return res.status(500).json({ error: findError.message });
  if (existingUser) {
    return res.status(409).json({ error: 'User already exists.' });
  }
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  // Insert new user
  const { data, error } = await supabase
    .from('User')
    .insert([{ email, password: hashedPassword }])
    .select('user_id, email');
  if (error) return res.status(400).json({ error: error.message });
  // Generate JWT
  const token = jwt.sign({ user_id: data[0].user_id, email: data[0].email }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.status(201).json({ message: 'User registered successfully', user: data[0], token });
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
    .select('user_id, email, password')
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
  res.json({ message: 'Login successful', user: { user_id: data.user_id, email: data.email }, token });
};

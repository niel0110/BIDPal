import { supabase } from '../config/supabase.js';

// Fetch all users
export const getAllUsers = async (req, res) => {
  const { data, error } = await supabase.from('User').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// Fetch user by ID
export const getUserById = async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase.from('User').select('*').eq('user_id', user_id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

// Create new user
export const createUser = async (req, res) => {
  const { Fname, Mname, Lname, role, email, contact_num, password } = req.body;
  const { data, error } = await supabase.from('User').insert([
    { Fname, Mname, Lname, role, email, contact_num, password }
  ]).select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
};

// Update user
export const updateUser = async (req, res) => {
  const { user_id } = req.params;
  const { Fname, Mname, Lname, role, email, contact_num, password, is_verified, last_login, deleted_at } = req.body;
  const { data, error } = await supabase.from('User').update({ Fname, Mname, Lname, role, email, contact_num, password, is_verified, last_login, deleted_at }).eq('user_id', user_id).select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
};

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase.from('User').update({ deleted_at: new Date().toISOString() }).eq('user_id', user_id).select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
};

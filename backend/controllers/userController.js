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
  const { Fname, Mname, Lname, role, email, contact_num, password, Avatar } = req.body;
  const { data, error } = await supabase.from('User').insert([
    { Fname, Mname, Lname, role, email, contact_num, password, Avatar }
  ]).select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
};

// Update user
export const updateUser = async (req, res) => {
  const { user_id } = req.params;
  const { Fname, Mname, Lname, role, email, contact_num, password, is_verified, last_login, deleted_at, Avatar } = req.body;
  const { data, error } = await supabase.from('User').update({ Fname, Mname, Lname, role, email, contact_num, password, is_verified, last_login, deleted_at, Avatar }).eq('user_id', user_id).select('*');
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

// Upload user avatar
export const uploadAvatar = async (req, res) => {
  try {
    const { user_id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `${user_id}-${timestamp}-${req.file.originalname}`;
    const filePath = `avatars/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    // Update user with avatar URL
    const { data: updatedUser, error: updateError } = await supabase
      .from('User')
      .update({ Avatar: avatarUrl })
      .eq('user_id', user_id)
      .select('*');

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      success: true,
      avatarUrl,
      user: updatedUser[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

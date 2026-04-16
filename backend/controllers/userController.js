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
  const { Fname, Mname, Lname, role, email, contact_num, password, Avatar, Birthday, Gender, Bio } = req.body;
  const { data, error } = await supabase.from('User').insert([
    { Fname, Mname, Lname, role, email, contact_num, password, Avatar, Birthday, Gender, Bio }
  ]).select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
};

// Update user
export const updateUser = async (req, res) => {
  const { user_id } = req.params;
  const { Fname, Mname, Lname, role, email, contact_num, password, is_verified, last_login, deleted_at, Avatar, Birthday, Gender, Bio } = req.body;
  const { data, error } = await supabase.from('User').update({ Fname, Mname, Lname, role, email, contact_num, password, is_verified, last_login, deleted_at, Avatar, Birthday, Gender, Bio }).eq('user_id', user_id).select('*');
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

    // Ensure the requesting user can only update their own avatar
    if (String(req.user?.user_id) !== String(user_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete the old avatar from storage if one exists
    const { data: existingUser } = await supabase
      .from('User')
      .select('Avatar')
      .eq('user_id', user_id)
      .single();

    if (existingUser?.Avatar) {
      // Extract the storage path from the public URL
      const url = existingUser.Avatar;
      const bucketMarker = '/user-avatars/';
      const bucketIndex = url.indexOf(bucketMarker);
      if (bucketIndex !== -1) {
        const oldPath = url.slice(bucketIndex + bucketMarker.length);
        await supabase.storage.from('user-avatars').remove([oldPath]);
      }
    }

    // Generate a unique filename using user_id + timestamp
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const filePath = `avatars/${user_id}-${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    // Update user record
    const { data: updatedUser, error: updateError } = await supabase
      .from('User')
      .update({ Avatar: avatarUrl })
      .eq('user_id', user_id)
      .select('*')
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ success: true, avatarUrl, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

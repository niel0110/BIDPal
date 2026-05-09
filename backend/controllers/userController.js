import { supabase } from '../config/supabase.js';
import { getUserAccountStatus } from '../services/accountStatusService.js';

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
  try {
    const { accountStatus } = await getUserAccountStatus(user_id);
    res.json({ ...data, accountStatus });
  } catch (statusError) {
    console.error('Account status lookup failed:', statusError);
    res.json(data);
  }
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

// Submit KYC — upload front & back ID photos to storage and set kyc_status = 'pending'
export const submitKYC = async (req, res) => {
  try {
    const { user_id } = req.params;

    const uploadSide = async (file, side) => {
      if (!file) return;
      const filePath = `${user_id}_${side}.jpg`;
      const { error } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
      if (error) console.error(`KYC ${side} upload failed:`, error.message);
    };

    const frontFile = req.files?.['id_photo_front']?.[0];
    const backFile = req.files?.['id_photo_back']?.[0];
    await Promise.all([uploadSide(frontFile, 'front'), uploadSide(backFile, 'back')]);

    // Always set kyc_status first — this column is guaranteed to exist
    const { error: statusError } = await supabase
      .from('User')
      .update({ kyc_status: 'pending' })
      .eq('user_id', user_id);

    if (statusError) return res.status(400).json({ error: statusError.message });

    // Best-effort: save optional ID metadata (columns may not exist in all deployments)
    const kyc_id_type = req.body?.id_type || null;
    const kyc_id_number = req.body?.id_number || null;
    if (kyc_id_type || kyc_id_number) {
      try {
        await supabase
          .from('User')
          .update({ kyc_id_type, kyc_id_number })
          .eq('user_id', user_id);
      } catch (_) { /* columns may not exist — ignore */ }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cancel seller account — schedule permanent deletion in 30 days
export const cancelSellerAccount = async (req, res) => {
  try {
    const { user_id } = req.params;
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    const { error } = await supabase
      .from('User')
      .update({ kyc_status: 'cancelled', deleted_at: deletionDate.toISOString() })
      .eq('user_id', user_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, deletion_date: deletionDate.toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

import { supabase } from '../config/supabase.js';

// Follow a seller
export const followSeller = async (req, res) => {
  try {
    const { followed_seller_id } = req.body;
    const { user_id } = req.user;

    if (!followed_seller_id) {
      return res.status(400).json({ error: 'followed_seller_id is required.' });
    }

    const { data, error } = await supabase
      .from('Follows')
      .insert([{ follower_id: user_id, followed_seller_id }])
      .select();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'You are already following this seller.' });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: 'Followed successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unfollow a seller
export const unfollowSeller = async (req, res) => {
  try {
    const { followed_seller_id } = req.body;
    const { user_id } = req.user;

    if (!followed_seller_id) {
      return res.status(400).json({ error: 'followed_seller_id is required.' });
    }

    const { data, error } = await supabase
      .from('Follows')
      .delete()
      .eq('follower_id', user_id)
      .eq('followed_seller_id', followed_seller_id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Follow record not found.' });
    }

    res.json({ message: 'Unfollowed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get followers of a seller
export const getFollowers = async (req, res) => {
  try {
    const { seller_id } = req.params;

    const { data, error } = await supabase
      .from('Follows')
      .select(`
        created_at,
        User:follower_id (
          user_id,
          Fname,
          Lname,
          Avatar
        )
      `)
      .eq('followed_seller_id', seller_id);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check if the logged-in user follows a specific seller
export const checkFollow = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { user_id } = req.user;

    const { data, error } = await supabase
      .from('Follows')
      .select('follower_id')
      .eq('follower_id', user_id)
      .eq('followed_seller_id', seller_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ is_following: !!data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get sellers followed by a user
export const getFollowing = async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabase
      .from('Follows')
      .select(`
        created_at,
        Seller:followed_seller_id (
          seller_id,
          store_name,
          store_handle,
          logo_url
        )
      `)
      .eq('follower_id', user_id);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

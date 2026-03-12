import { supabase } from '../config/supabase.js';

// Fetch all sellers
export const getAllSellers = async (req, res) => {
  try {
    const { data, error } = await supabase.from('Seller').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch seller by seller_id
export const getSellerById = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { data, error } = await supabase
      .from('Seller')
      .select('*')
      .eq('seller_id', seller_id)
      .single();
    if (error) return res.status(404).json({ error: 'Seller not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch seller by user_id (get seller profile for logged-in user)
export const getSellerByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { data, error } = await supabase
      .from('Seller')
      .select('*')
      .eq('user_id', user_id)
      .single();
    if (error) return res.status(404).json({ error: 'Seller profile not found for this user' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new seller (open a shop)
export const createSeller = async (req, res) => {
  try {
    const { store_name, business_category, store_handle, store_description, user_id } = req.body;

    // Validation
    if (!store_name || !user_id) {
      return res.status(400).json({ error: 'store_name and user_id are required.' });
    }

    // Check if user already has a seller profile
    const { data: existingSeller, error: checkError } = await supabase
      .from('Seller')
      .select('seller_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (checkError) return res.status(500).json({ error: checkError.message });
    if (existingSeller) {
      return res.status(409).json({ error: 'This user already has a seller account.' });
    }

    const { data, error } = await supabase
      .from('Seller')
      .insert([
        {
          store_name,
          business_category: business_category || null,
          store_handle: store_handle || null,
          store_description: store_description || null,
          user_id,
        }
      ])
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Seller account created successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update seller
export const updateSeller = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { store_name, business_category, store_handle, store_description } = req.body;

    const { data, error } = await supabase
      .from('Seller')
      .update({
        ...(store_name && { store_name }),
        ...(business_category !== undefined && { business_category }),
        ...(store_handle !== undefined && { store_handle }),
        ...(store_description !== undefined && { store_description }),
      })
      .eq('seller_id', seller_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    res.json({ message: 'Seller updated successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete seller (hard delete)
export const deleteSeller = async (req, res) => {
  try {
    const { seller_id } = req.params;

    const { data, error } = await supabase
      .from('Seller')
      .delete()
      .eq('seller_id', seller_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });;
    }
    res.json({ message: 'Seller account deleted successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

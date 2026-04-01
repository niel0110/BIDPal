import { supabase } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const locationsFilePath = path.join(__dirname, '../data/philippine-locations.json');

// Load Philippine locations data
let philippineLocations = null;
function loadLocations() {
  if (!philippineLocations) {
    const data = fs.readFileSync(locationsFilePath, 'utf8');
    philippineLocations = JSON.parse(data);
  }
  return philippineLocations;
}

// Fetch all addresses for a user
export const getAddressesByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { data, error } = await supabase
      .from('Addresses')
      .select('*')
      .eq('user_id', user_id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch single address by ID
export const getAddressById = async (req, res) => {
  try {
    const { address_id } = req.params;
    const { data, error } = await supabase
      .from('Addresses')
      .select('*')
      .eq('address_id', address_id)
      .single();

    if (error) return res.status(404).json({ error: 'Address not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch default address for a user
export const getDefaultAddress = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { data, error } = await supabase
      .from('Addresses')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'No default address found' });
      }
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new address
export const createAddress = async (req, res) => {
  try {
    const { 
      user_id, 
      Line1, 
      Line2, 
      household_blk_st, 
      Barangay, 
      municipality_city, 
      zip_code, 
      Country, 
      is_default,
      latitude,
      longitude,
      region,
      province,
      address_type 
    } = req.body;

    console.log('CreateAddress received:', req.body);

    // Validation - Line1 is required (geofence result or manual entry)
    if (!user_id || !Line1 || !Country) {
      console.error('Validation failed - missing required fields');
      return res.status(400).json({ 
        error: 'Required fields: user_id, Line1, Country' 
      });
    }

    // Verify user exists
    const { data: userCheck, error: userError } = await supabase
      .from('User')
      .select('user_id')
      .eq('user_id', user_id)
      .single();

    if (userError || !userCheck) {
      console.error('User not found:', user_id, userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // If setting as default, unset other defaults for this user
    if (is_default) {
      const { error: updateError } = await supabase
        .from('Addresses')
        .update({ is_default: false })
        .eq('user_id', user_id);
      
      if (updateError) {
        console.error('Error unsetting defaults:', updateError);
      }
    }

    const { data, error } = await supabase
      .from('Addresses')
      .insert([
        {
          user_id,
          Line1,
          Line2: Line2 || null,
          'Household/blk st.': household_blk_st || null,
          Barangay: Barangay || null,
          'Municipality/City': municipality_city || null,
          'zip code': zip_code || null,
          Country,
          is_default: is_default || false,
          latitude: latitude || null,
          longitude: longitude || null,
          region: region || null,
          province: province || null,
          address_type: address_type || null
        }
      ])
      .select('*');

    if (error) {
      console.error('Database insert error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Address created successfully:', data);
    res.status(201).json({ message: 'Address created successfully', data: data[0] });
  } catch (err) {
    console.error('CreateAddress exception:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update address
export const updateAddress = async (req, res) => {
  try {
    const { address_id } = req.params;
    const { Line1, Line2, household_blk_st, Barangay, municipality_city, zip_code, Country, is_default, region, province } = req.body;

    // Get current address to find user_id
    const { data: currentAddress, error: fetchError } = await supabase
      .from('Addresses')
      .select('*')
      .eq('address_id', address_id)
      .single();

    if (fetchError || !currentAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If setting as default, unset other defaults for this user
    if (is_default) {
      await supabase
        .from('Addresses')
        .update({ is_default: false })
        .eq('user_id', currentAddress.user_id);
    }

    const updateData = {};
    if (Line1 !== undefined) updateData.Line1 = Line1;
    if (Line2 !== undefined) updateData.Line2 = Line2;
    if (household_blk_st !== undefined) updateData['Household/blk st.'] = household_blk_st;
    if (Barangay !== undefined) updateData.Barangay = Barangay;
    if (municipality_city !== undefined) updateData['Municipality/City'] = municipality_city;
    if (zip_code !== undefined) updateData['zip code'] = zip_code;
    if (Country !== undefined) updateData.Country = Country;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (region !== undefined) updateData.region = region;
    if (province !== undefined) updateData.province = province;

    const { data, error } = await supabase
      .from('Addresses')
      .update(updateData)
      .eq('address_id', address_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Address updated successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete address
export const deleteAddress = async (req, res) => {
  try {
    const { address_id } = req.params;

    // Check if this is the default address
    const { data: addressData, error: checkError } = await supabase
      .from('Addresses')
      .select('user_id, is_default')
      .eq('address_id', address_id)
      .single();

    if (checkError || !addressData) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const { data, error } = await supabase
      .from('Addresses')
      .delete()
      .eq('address_id', address_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If deleted address was default, set another as default
    if (addressData.is_default) {
      const { data: remainingAddresses } = await supabase
        .from('Addresses')
        .select('address_id')
        .eq('user_id', addressData.user_id)
        .limit(1);

      if (remainingAddresses && remainingAddresses.length > 0) {
        await supabase
          .from('Addresses')
          .update({ is_default: true })
          .eq('address_id', remainingAddresses[0].address_id);
      }
    }

    res.json({ message: 'Address deleted successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Set address as default
export const setDefaultAddress = async (req, res) => {
  try {
    const { address_id } = req.params;

    // Get the address
    const { data: address, error: fetchError } = await supabase
      .from('Addresses')
      .select('user_id')
      .eq('address_id', address_id)
      .single();

    if (fetchError || !address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Unset all defaults for this user
    await supabase
      .from('Addresses')
      .update({ is_default: false })
      .eq('user_id', address.user_id);

    // Set this address as default
    const { data, error } = await supabase
      .from('Addresses')
      .update({ is_default: true })
      .eq('address_id', address_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Address set as default successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unset default address (remove default flag without setting another)
export const unsetDefaultAddress = async (req, res) => {
  try {
    const { address_id } = req.params;

    const { data, error } = await supabase
      .from('Addresses')
      .update({ is_default: false })
      .eq('address_id', address_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Default address removed successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Count addresses for a user
export const countUserAddresses = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { count, error } = await supabase
      .from('Addresses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all regions
export const getRegions = async (req, res) => {
  try {
    const locations = loadLocations();
    const regions = locations.regions.map(r => ({
      region: r.region,
      name: r.name
    }));
    res.json(regions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get provinces by region
export const getProvincesByRegion = async (req, res) => {
  try {
    const { region } = req.params;
    const locations = loadLocations();
    
    const regionData = locations.regions.find(r => r.region.toLowerCase() === region.toLowerCase());
    if (!regionData) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    const provinces = regionData.provinces.map(p => p.name);
    res.json(provinces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get cities by province
export const getCitiesByProvince = async (req, res) => {
  try {
    const { region, province } = req.params;
    const locations = loadLocations();
    
    const regionData = locations.regions.find(r => r.region.toLowerCase() === region.toLowerCase());
    if (!regionData) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    const provinceData = regionData.provinces.find(p => p.name.toLowerCase() === province.toLowerCase());
    if (!provinceData) {
      return res.status(404).json({ error: 'Province not found' });
    }
    
    const cities = provinceData.cities.map(c => c.name);
    res.json(cities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get cities by region (legacy - returns all cities in region)
export const getCitiesByRegion = async (req, res) => {
  try {
    const { region } = req.params;
    const locations = loadLocations();
    
    const regionData = locations.regions.find(r => r.region.toLowerCase() === region.toLowerCase());
    if (!regionData) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    const cities = [];
    regionData.provinces.forEach(p => {
      p.cities.forEach(c => {
        cities.push(c.name);
      });
    });
    
    res.json(cities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get barangays by city
export const getBarangaysByCity = async (req, res) => {
  try {
    const { city } = req.params;
    const locations = loadLocations();
    
    let barangays = [];
    
    for (const region of locations.regions) {
      for (const province of region.provinces) {
        const cityData = province.cities.find(c => c.name.toLowerCase() === city.toLowerCase());
        if (cityData) {
          barangays = cityData.barangays;
          break;
        }
      }
      if (barangays.length > 0) break;
    }
    
    if (barangays.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.json(barangays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

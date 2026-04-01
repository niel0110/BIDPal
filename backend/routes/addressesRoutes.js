import express from 'express';
import {
  getAddressesByUser,
  getAddressById,
  getDefaultAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  unsetDefaultAddress,
  countUserAddresses,
  getRegions,
  getProvincesByRegion,
  getCitiesByProvince,
  getCitiesByRegion,
  getBarangaysByCity
} from '../controllers/addressesController.js';

const router = express.Router();

// Get all addresses for a user
router.get('/user/:user_id', getAddressesByUser);

// Get default address for a user
router.get('/user/:user_id/default', getDefaultAddress);

// Count addresses for a user
router.get('/user/:user_id/count', countUserAddresses);

// Location endpoints - GET before /:address_id to avoid conflicts
router.get('/locations/regions', getRegions);
router.get('/locations/provinces/:region', getProvincesByRegion);
router.get('/locations/cities/:region/:province', getCitiesByProvince);
router.get('/locations/cities/:region', getCitiesByRegion);
router.get('/locations/barangays/:city', getBarangaysByCity);

// Get single address
router.get('/:address_id', getAddressById);

// Create new address
router.post('/', createAddress);

// Update address
router.put('/:address_id', updateAddress);

// Delete address
router.delete('/:address_id', deleteAddress);

// Set address as default
router.patch('/:address_id/default', setDefaultAddress);

// Unset default (remove default flag from an address)
router.patch('/:address_id/unset-default', unsetDefaultAddress);

export default router;

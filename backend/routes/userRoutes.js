import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', getAllUsers);
router.get('/:user_id', getUserById);
router.post('/', createUser);
router.put('/:user_id', updateUser);
router.delete('/:user_id', deleteUser);

export default router;

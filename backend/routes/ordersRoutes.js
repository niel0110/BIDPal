import express from 'express';
import { 
    getOrdersByUser, 
    getOrderById, 
    createOrder, 
    updateOrderStatus 
} from '../controllers/ordersController.js';

const router = express.Router();

router.get('/user/:user_id', getOrdersByUser);
router.get('/:order_id', getOrderById);
router.post('/', createOrder);
router.patch('/:order_id/status', updateOrderStatus);

export default router;

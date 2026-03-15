import express from 'express';
import { 
    getCartByUser, 
    addToCart, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart 
} from '../controllers/cartController.js';

const router = express.Router();

router.get('/:user_id', getCartByUser);
router.post('/', addToCart);
router.patch('/:cart_id', updateCartQuantity);
router.delete('/:cart_id', removeFromCart);
router.delete('/user/:user_id', clearCart);

export default router;

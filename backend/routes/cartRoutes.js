import express from 'express';
import { 
    getCartByUser, 
    addToCart, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart,
    stashCartItem,
    unstashCartItem,
    removeOrderedItemsFromCart
} from '../controllers/cartController.js';

const router = express.Router();

router.get('/:user_id', getCartByUser);
router.post('/', addToCart);
router.patch('/:cart_id', updateCartQuantity);
router.patch('/stash/:cartItem_id', stashCartItem);
router.patch('/unstash/:cartItem_id', unstashCartItem);
router.delete('/:cart_id', removeFromCart);
router.delete('/user/:user_id', clearCart);
router.delete('/user/:user_id/ordered', removeOrderedItemsFromCart);

export default router;

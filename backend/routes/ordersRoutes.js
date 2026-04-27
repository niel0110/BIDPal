import express from 'express';
import {
    getOrdersByUser,
    getOrderById,
    createOrder,
    updateOrderStatus,
    getAuctionWinsByUser,
    processAuctionPayment,
    getAuctionSeller,
    getSellerOrders,
    getSellerOrderDetail,
    confirmPayment,
    shipOrder,
    confirmDelivery,
    getOrderReceipt
} from '../controllers/ordersController.js';

const router = express.Router();

router.get('/user/:user_id', getOrdersByUser);
router.get('/user/:user_id/auction-wins', getAuctionWinsByUser);
router.get('/:order_id', getOrderById);
router.post('/', createOrder);
router.put('/:order_id/status', updateOrderStatus);
router.patch('/:order_id/status', updateOrderStatus);

// Auction-specific routes
router.post('/auction/:auction_id/pay', processAuctionPayment);
router.get('/auction/:auction_id/seller', getAuctionSeller);

// Seller order management
router.get('/seller/:seller_id', getSellerOrders);
router.get('/seller/detail/:order_id', getSellerOrderDetail);
router.put('/:order_id/confirm-payment', confirmPayment);
router.put('/:order_id/ship', shipOrder);
router.put('/:order_id/confirm-delivery', confirmDelivery);

// Receipt
router.get('/:order_id/receipt', getOrderReceipt);

export default router;

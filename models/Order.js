// models/Order.js
const mongoose = require('mongoose');

if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

const orderSchema = new mongoose.Schema({
  userId: String,
  items: Array,        // 구매한 상품 목록
  totalPrice: Number,  // 결제 금액
  paymentMethod: String, // 'credit' 또는 'cash' (결제 수단 추가)
  status: String,      // 'success' 또는 'fail'
  reason: String,      // 실패 시 이유
  sellerIds: [String], // 판매자 ID 배열
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
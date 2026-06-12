const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  userId: { type: String, required: true },      // 담은 유저 ID
  productId: { type: String, required: true },   // 상품 고유 ID
  title: { type: String, required: true },       // 상품명
  price: { type: Number, required: true },       // 가격
  image: { type: String, required: true },       // 이미지 경로
  addedAt: { type: Date, default: Date.now },    // 담은 날짜
  quantity: { type: Number, default: 1 },         // 사용자가 담은 수량
  maxStock: { type: Number, default: 1 },     // 상품의 최대 재고
  sellerId: { type: String }     
});

module.exports = mongoose.model('Cart', CartSchema);
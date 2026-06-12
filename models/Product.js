const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  content: { type: String, required: true },
  image: { type: String }, 
  writer: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  stock: { type: Number, default: 1 } 
});

module.exports = mongoose.model('Product', ProductSchema);
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  friends: [{ type: String }],
  cash: { type: Number, default: 0 },
  credit: { type: Number, default: 0 } 
});

module.exports = mongoose.model('User', UserSchema);
const mongoose = require('mongoose');
const CommentSchema = new mongoose.Schema({
  // 어떤 상품(또는 게시글)에 달린 댓글인지 식별하는 ID
  targetId: { type: String, required: true }, 
  
  // 댓글 작성자의 정보 
  writerId: { type: String, required: true },
  writerName: { type: String, required: true },
  
  // 댓글 내용과 작성 시간, 별점
  content: { type: String, required: true },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', CommentSchema);
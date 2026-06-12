const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Comment = require('../models/Comment');

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

const isAuth = (req, res, next) => {
    if (req.session.user) return next();
    res.send(`<script>alert('로그인이 필요한 서비스입니다.'); location.href='/auth/login';</script>`);
};

// 메인 페이지
router.get('/', async (req, res) => {
    try {
        let friendProducts = [];
        let user = null;
        if (req.session.user) {
            user = await User.findOne({ id: req.session.user.id });
            if (user && user.friends.length > 0) {
                friendProducts = await Product.find({ writer: { $in: user.friends } }).sort({ createdAt: -1 }).limit(3);
            }
        }
        const allProducts = await Product.find().sort({ createdAt: -1 });
        res.render('index', { friendProducts, allProducts, user, serverIp: '192.168.219.121:3000' });
    } catch (err) { res.status(500).send('서버 오류 발생'); }
});

// 상품 등록
router.get('/product/create', isAuth, (req, res) => { res.render('market/create'); });
router.post('/product/create', isAuth, upload.fields([{ name: 'image' }, { name: 'textFile' }]), async (req, res) => {
    try {
        const { title, price, content, stock } = req.body;
        let finalContent = content || '';
        if (req.files && req.files['textFile']) {
            const textFilePath = req.files['textFile'][0].path;
            finalContent += `\n\n[첨부된 .txt 문서 내용]:\n${fs.readFileSync(textFilePath, 'utf8')}`;
            fs.unlinkSync(textFilePath);
        }
        const imagePath = req.files['image'] ? `/uploads/${req.files['image'][0].filename}` : '/uploads/default.jpg';
        await Product.create({ title, price, content: finalContent, image: imagePath, writer: req.session.user.id, stock: parseInt(stock) || 1 });
        res.redirect('/');
    } catch (err) { res.status(500).send('물품 등록 실패'); }
});

// 상세 페이지
router.get('/product/:id', async (req, res) => {
    try { const product = await Product.findById(req.params.id);
        const comments = await Comment.find({ targetId: req.params.id }).sort({ createdAt: -1 });
         res.render('market/detail', { product, comments }); }
    catch (err) { res.status(404).send('물품을 찾을 수 없습니다.'); }
});

// 삭제
router.post('/product/delete/:id', isAuth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product.writer === req.session.user.id) { await Product.findByIdAndDelete(req.params.id); res.redirect('/'); }
        else { res.send(`<script>alert('삭제 권한이 없습니다.'); history.back();</script>`); }
    } catch (err) { res.status(500).send('삭제 실패'); }
});

// 친구 추가
router.post('/friend/add', isAuth, async (req, res) => {
    const { friendId } = req.body;
    if (friendId === req.session.user.id) return res.send(`<script>alert('자신은 친구 추가할 수 없습니다.'); history.back();</script>`);
    const targetUser = await User.findOne({ id: friendId });
    if (!targetUser) return res.send(`<script>alert('존재하지 않는 사용자 ID입니다.'); history.back();</script>`);
    await User.updateOne({ id: req.session.user.id }, { $addToSet: { friends: friendId } });
    res.send(`<script>alert('${friendId} 상인이 친구로 등록되었습니다.'); location.href='/';</script>`);
});

// 판매자 상품 조회
router.get('/user/products/:writerId', async (req, res) => {
    try {
        const writerId = req.params.writerId;
        const userProducts = await Product.find({ writer: writerId }).sort({ createdAt: -1 });
        res.render('market/user_products', { writerId, userProducts });
    } catch (err) { res.status(500).send('판매자 상품 조회 실패'); }
});

router.post('/market/cart/add', isAuth, async (req, res) => {
    try {
        const { productId, title, price, image } = req.body;
        const product = await Product.findById(productId);
        if (!product) return res.send(`<script>alert('상품 없음'); history.back();</script>`);
        if (!product.writer) {
            console.error("데이터 오류: 상품 ID", productId, "에 writer 정보가 없습니다!");
            return res.send(`<script>alert('판매자 정보가 없는 상품은 담을 수 없습니다.'); history.back();</script>`);
        }
        const existing = await Cart.findOne({ userId: req.session.user.id, productId });
        if (existing) {
            if (existing.quantity + 1 > product.stock) return res.send(`<script>alert('재고가 부족합니다.'); history.back();</script>`);
            await Cart.updateOne({ _id: existing._id }, { $inc: { quantity: 1 } });
        } else {
            await Cart.create({ userId: req.session.user.id, productId, title, price, image, quantity: 1, maxStock: product.stock, sellerId: product.writer });
        }
        res.redirect('/market/cart');
    } catch (err) { res.status(500).send('서버 오류'); }
});

router.get('/market/cart', isAuth, async (req, res) => {
    try {
        const cartItems = await Cart.find({ userId: req.session.user.id });
        const user = await User.findOne({ id: req.session.user.id });
        for (let item of cartItems) {
            const product = await Product.findById(item.productId);
            if (product) item.maxStock = product.stock; 
        }
        res.render('market/cart', { cartItems, user });
    } catch (err) { res.status(500).send('조회 실패'); }
});

router.post('/market/cart/update', isAuth, async (req, res) => {
    try {
        const { cartId, quantity } = req.body;
        await Cart.findByIdAndUpdate(cartId, { quantity: parseInt(quantity) });
        res.redirect('/market/cart');
    } catch (err) { res.status(500).send('업데이트 실패'); }
});

router.post('/market/cart/delete', isAuth, async (req, res) => {
    await Cart.deleteMany({ _id: req.body.cartId });
    res.redirect('/market/cart');
});

// 마이페이지 대시보드 및 내 등록 물품 관리 라우터
router.get('/mypage', isAuth, async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const user = await User.findOne({ id: req.session.user.id });
        
        const selectedMonth = req.query.month || new Date().toISOString().slice(0, 7);
        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);

        // 성공한 주문만 통계 계산
        const monthlyBuyerOrders = await Order.find({ userId: req.session.user.id, status: 'success', createdAt: { $gte: startDate, $lt: endDate } });
        const monthlySellerOrders = await Order.find({ sellerIds: req.session.user.id, status: 'success', createdAt: { $gte: startDate, $lt: endDate } });

        const totalPurchase = monthlyBuyerOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
        
        // 판매 수익을 크레딧과 가상현금으로 분리
        let totalSalesCredit = 0;
        let totalSalesCash = 0;
        const itemRevenueMap = {};

        monthlySellerOrders.forEach(order => {
            const isCredit = order.paymentMethod === 'credit';
            order.items.filter(item => item.writer === req.session.user.id).forEach(item => {
                const revenue = item.price * item.quantity;
                if (isCredit) totalSalesCredit += revenue;
                else totalSalesCash += revenue;
                itemRevenueMap[item.title] = (itemRevenueMap[item.title] || 0) + revenue;
            });
        });

        const limit = 5;
        const orderPage = parseInt(req.query.orderPage) || 1;
        const salesPage = parseInt(req.query.salesPage) || 1;
        const totalOrders = await Order.countDocuments({ userId: req.session.user.id });
        const orders = await Order.find({ userId: req.session.user.id }).sort({ createdAt: -1 }).skip((orderPage - 1) * limit).limit(limit);
        const totalSalesCount = await Order.countDocuments({ sellerIds: req.session.user.id });
        const salesHistory = await Order.find({ sellerIds: req.session.user.id }).sort({ createdAt: -1 }).skip((salesPage - 1) * limit).limit(limit);
        
        // 현재 로그인한 상인(본인)이 등록한 물품 목록 전체 조회 (최신순)
        const myProducts = await Product.find({ writer: req.session.user.id }).sort({ createdAt: -1 });
        
        // 렌더링 파트에 기존 변수 보존 및 myProducts 안전하게 탑탑 추가
        res.render('mypage', { 
            user, orders, salesHistory, orderPage, totalOrderPages: Math.ceil(totalOrders / limit),
            salesPage, totalSalesPages: Math.ceil(totalSalesCount / limit),
            selectedMonth, totalPurchase, totalSalesCredit, totalSalesCash, itemRevenueMap,
            myProducts // 뷰 레이어로 동적 데이터 바인딩
        });
    } catch (err) { 
        console.error(err); 
        res.status(500).send('마이페이지 조회 오류'); 
    }
});

// 지갑
router.get('/wallet', isAuth, async (req, res) => {
    try { const user = await User.findOne({ id: req.session.user.id }).lean(); res.render('wallet', { user }); }
    catch (err) { res.status(500).send('지갑 페이지 오류'); }
});

router.post('/wallet/ad', isAuth, async (req, res) => {
    try { await User.updateOne({ id: req.session.user.id }, { $inc: { credit: 5000 } }); res.send('<script>alert("5,000 크레딧이 적립되었습니다."); location.href="/wallet";</script>'); }
    catch (err) { res.status(500).send('오류'); }
});

router.post('/wallet/charge', isAuth, async (req, res) => {
    try { const { amount } = req.body; await User.updateOne({ id: req.session.user.id }, { $inc: { cash: parseInt(amount) } }); res.send(`<script>alert('${amount}원이 충전되었습니다.'); location.href="/wallet";</script>`); }
    catch (err) { res.status(500).send('오류'); }
});


// 결제 처리 
router.post('/order', isAuth, async (req, res) => {
    try {
        const { isCreditUsed, isCashUsed } = req.body;
        const buyer = await User.findOne({ id: req.session.user.id });
        const cartItems = await Cart.find({ userId: buyer.id });
        
        if (!cartItems || cartItems.length === 0) {
            return res.send('<script>alert("장바구니가 비어있습니다."); history.back();</script>');
        }
        
        const totalPrice = cartItems.reduce((acc, cur) => acc + (cur.price * cur.quantity), 0);
        const paymentMethod = (isCashUsed === 'true') ? 'cash' : 'credit';
        
        //  1. 잔고 부족으로 인한 실패 처리 시에도 productId 포함
        if ((paymentMethod === 'credit' && buyer.credit < totalPrice) || (paymentMethod === 'cash' && buyer.cash < totalPrice)) {
            await Order.create({ 
                userId: buyer.id, 
                items: cartItems.map(item => ({
                    productId: item.productId, // 
                    title: item.title,
                    quantity: item.quantity,
                    price: item.price,
                    writer: item.sellerId
                })), 
                sellerIds: [...new Set(cartItems.map(i => i.sellerId))], 
                totalPrice, 
                paymentMethod, 
                status: 'fail', 
                reason: '잔고 부족', 
                createdAt: new Date() 
            });
            return res.send('<script>alert("잔고가 부족합니다."); history.back();</script>');
        }
        
        // 재고 확인 검사
        for (let item of cartItems) {
            const product = await Product.findById(item.productId);
            //  2. 재고 부족으로 인한 실패 처리 시에도 productId 포함
            if (!product || product.stock < item.quantity) {
                await Order.create({ 
                    userId: buyer.id, 
                    items: cartItems.map(i => ({
                        productId: i.productId, // 
                        title: i.title,
                        quantity: i.quantity,
                        price: i.price,
                        writer: i.sellerId
                    })), 
                    sellerIds: [...new Set(cartItems.map(i => i.sellerId))], 
                    totalPrice, 
                    paymentMethod, 
                    status: 'fail', 
                    reason: `재고 부족 (${item.title})`, 
                    createdAt: new Date() 
                });
                return res.send(`<script>alert('${item.title} 재고가 부족합니다.'); history.back();</script>`);
            }
        }
        
        // 구매자 잔고 차감
        if (paymentMethod === 'credit') await User.updateOne({ id: buyer.id }, { $inc: { credit: -totalPrice } });
        else await User.updateOne({ id: buyer.id }, { $inc: { cash: -totalPrice } });
        
        // 재고 차감 및 판매자 정산
        for (let item of cartItems) {
            await Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } });
            const amount = item.price * item.quantity;
            if (paymentMethod === 'credit') await User.updateOne({ id: item.sellerId }, { $inc: { credit: amount } });
            else await User.updateOne({ id: item.sellerId }, { $inc: { cash: amount } });
        }
        
        //  3. 결제 성공 처리 시 items 배열 내부에 productId를 정확히 맵핑하여 저장
        await Order.create({ 
            userId: buyer.id, 
            items: cartItems.map(item => ({ 
                productId: item.productId, // 
                title: item.title, 
                quantity: item.quantity, 
                price: item.price, 
                writer: item.sellerId 
            })), 
            sellerIds: [...new Set(cartItems.map(item => item.sellerId).filter(id => id))], 
            totalPrice, 
            paymentMethod, 
            status: 'success', 
            reason: '판매 완료', 
            createdAt: new Date() 
        });
        
        // 장바구니 비우기
        await Cart.deleteMany({ userId: buyer.id });
        res.send('<script>alert("결제가 완료되었습니다."); location.href="/mypage";</script>');
        
    } catch (error) { 
        console.error(error); 
        res.send('<script>alert("결제 처리 중 오류가 발생했습니다."); history.back();</script>'); 
    }
});

// routes/market.js 맨 아래 댓글 등록 라우터 교체
router.post('/comment/:targetId', async (req, res) => {
  if (!req.session.user) {
    return res.send('<script>alert("로그인이 필요합니다!"); history.back();</script>');
  }

  try {
    const buyerId = req.session.user.id;
    const productId = req.params.targetId;

    // 1. 이 유저가 해당 상품을 성공적으로 구매한 적이 있는지 Order DB에서 조회
    const hasPurchased = await Order.findOne({
      userId: buyerId,
      status: 'success',
      'items.productId': productId
    });

    // 구매 내역이 없다면 튕겨내기
    if (!hasPurchased) {
      return res.send('<script>alert("❌ 해당 물품을 실제로 구매한 상인만 한줄평과 점수를 남길 수 있습니다."); history.back();</script>');
    }

    // 2. 이 유저가 이 상품(targetId)에 이미 작성한 댓글이 있는지 Comment DB에서 조회
    const alreadyCommented = await Comment.findOne({
      targetId: productId,
      writerId: buyerId
    });

    // 이미 댓글을 작성했다면 튕겨내기 (1인 1댓글 제한)
    if (alreadyCommented) {
      return res.send('<script>alert(" 이미 이 물품에 평점 리뷰를 남기셨습니다. 한줄평은 한 사람당 하나만 작성할 수 있습니다."); history.back();</script>');
    }

    const currentUser = await User.findOne({ id: buyerId });

    const newComment = new Comment({
      targetId: productId, 
      writerId: currentUser.id,
      writerName: currentUser.name,
      content: req.body.content,
      rating: parseInt(req.body.rating) || 5 
    });

    await newComment.save();
    res.redirect(`/product/${productId}`); 

  } catch (err) {
    console.error('댓글 및 점수 저장 오류:', err);
    res.send('<script>alert("처리 중 오류가 발생했습니다."); history.back();</script>');
  }
});

module.exports = router;
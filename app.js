const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const app = express();

// User 모델 불러오기 (크레딧 조회를 위해 필요)
const User = require('./models/User');

// MongoDB 연결 [조건: 몽고DB 사용]
mongoose.connect('mongodb+srv://seojoon:MdXeUUASoi0l4DOS@cluster0.qotzqrt.mongodb.net/?appName=Cluster0')
  .then(() => console.log('MongoDB 연결 성공!'))
  .catch(err => console.error('MongoDB 연결 실패:', err));

// EJS 템플릿 엔진 설정 [조건: ejs 미들웨어 사용]
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 공통 미들웨어 세팅 [조건: 다양한 미들웨어 사용]
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 미들웨어 설정 [조건: 세션 구현]
app.use(session({
  secret: 'mymarket_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000 * 30 } // 30분 로그인 유지
}));

// 모든 EJS 템플릿에서 'user' 정보를 DB에서 직접 가져와 사용하도록 전역 미들웨어 수정
app.use(async (req, res, next) => {
  if (req.session.user) {
    try {
      // DB에서 현재 로그인한 유저의 최신 정보를 가져옴 (credit 포함)
      const user = await User.findOne({ id: req.session.user.id });
      res.locals.user = user;
    } catch (err) {
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  next();
});

// 라우터 객체 연결 [조건: 라우터 객체 이용]
const authRouter = require('./routes/auth');
const marketRouter = require('./routes/market');

app.use('/auth', authRouter);
app.use('/', marketRouter); // 메인 및 게시판 전반

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT} 에서 정상 가동 중입니다.`);
});
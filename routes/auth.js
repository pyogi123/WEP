const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 회원가입 페이지
router.get('/register', (req, res) => {
  res.render('auth/register');
});

// 회원가입 처리
router.post('/register', async (req, res) => {
  const { id, password, name, referralId } = req.body;
  
  try {
    let newCredit = 0; // 신규 가입자 기본 크레딧

    // 추천인 로직
    if (referralId && referralId.trim() !== '') {
      const referrer = await User.findOne({ id: referralId });
      
      // 추천인이 존재할 경우
      if (referrer) {
        newCredit = 100000; // 가입자에게 10만 크레딧
        // 추천인에게 5만 크레딧 추가
        await User.updateOne({ id: referralId }, { $inc: { credit: 50000 } });
        console.log(`추천인 ${referralId}에게 5만 크레딧 지급 완료`);
      }
    }

    // 회원 데이터 저장
    await User.create({ 
      id, 
      password, 
      name, 
      friends: [], 
      credit: newCredit 
    });
    
    res.send(`<script>alert('회원가입 성공!'); location.href='/auth/login';</script>`);
  } catch (err) {
    console.error(err);
    res.send(`<script>alert('회원가입 오류: ID 중복 등을 확인해주세요.'); history.back();</script>`);
  }
});

// 로그인 페이지
router.get('/login', (req, res) => {
  res.render('auth/login');
});

// 로그인 처리
router.post('/login', async (req, res) => {
  const { id, password } = req.body;
  const user = await User.findOne({ id, password });

  if (user) {
    req.session.user = { id: user.id, name: user.name };
    res.redirect('/');
  } else {
    res.send(`<script>alert('ID 또는 비밀번호가 틀렸습니다.'); history.back();</script>`);
  }
});

// 로그아웃 처리
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
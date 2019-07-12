let express = require('express');
let router = express.Router();
let WeChat = require("../../src/index");

let weChat = new WeChat({
    appid: "wx7840b964dc3d6e4d",
    secret: "52089b4e62311ce1b872d28fd3c8e90d",
    token: "woaizhongguo"
});

/**
 * 验证域名配置
 */
router.get('/api/v1/wx', weChat.message.checkSignature());


/**
 * 接受微信消息 事件等
 */
router.post('/api/v1/wx', weChat.message.userMessage({
    message:{
        text: function (msg) {
            return {
                ToUserName: msg.FromUserName,
                FromUserName: msg.ToUserName,
                Content: "ee"   //回复内容
            }
        }
    },
    event:{
        subscribe:function (msg) {
            return {
                ToUserName: msg.FromUserName,
                FromUserName: msg.ToUserName,
                Content: "欢迎关注"   //回复内容
            }
        }
    }
}));


/**
 * 微信授权
 */
router.get('/api/v1/wx/auth', function (req, res, next) {
    let redirectUrl = "http://company.getlove.cn/wx/userInfo";
    let path = weChat.web.authUrl(redirectUrl);
    res.redirect(path);
});

/**
 * 获取用户信息
 */
router.get("/api/v1/wx/userInfo", function (req, res, next) {
    if (req.query.code) {
        weChat.web.getUserInfo(req.query.code).then((userInfo) => {
            console.log(userInfo);
            res.send("success");
        }).catch(function (err) {
            console.log(err);
            res.send("error");
        });
    }
});

/**
 * 获取js-sdk
 */
router.get("/api/v1/js_sdk_sign", function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    weChat.web.jssdkSignature(req.query.url)
        .then((data) => {
            res.send({
                code:0,
                data
            })
        })
});


module.exports = router;
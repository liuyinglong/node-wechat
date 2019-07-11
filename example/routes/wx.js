let express = require('express');
let router = express.Router();
let WeChat = require("../../src/index");

let weChat = new WeChat({
    appid: "wx484860c8c07c3af7",
    secret: "cb609d740ba300b0cc6fa411982c9daf",
    token: "testwechat"
});

/**
 * 验证域名配置
 */
router.get('/', function (req, res, next) {
    weChat.message.checkSignature(req, res);
});

/**
 * 接受微信消息 事件等
 */
router.post('/', weChat.message.userMessage({
    text: function (msg) {
        console.log(msg)
        return {
            ToUserName: msg.FromUserName,
            FromUserName: msg.ToUserName,
            Content: "ee"   //回复内容
        }
    }
}));


/**
 * 微信授权
 */
router.get("/auth", function (req, res, next) {
    let redirectUrl = "http://company.getlove.cn/wx/userInfo";
    let path = weChat.web.authUrl(redirectUrl);
    res.redirect(path);
});

/**
 * 获取用户信息
 */
router.get("/userInfo", function (req, res, next) {
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
 * 获取前面
 */
router.get("/js_sdk_sign", function (req, res, next) {
    weChat.web.jssdkSignature(req.query.url)
        .then((data) => {
            res.send(data)
        })
});


module.exports = router;
let WeChat = require("../../src/index");

let weChat = new WeChat({
    appid: "wx2bc3693071de290e",
    secret: "a3f4a3d4c27cd69ab3d22e587d4b20a1",
    token: "testwechat"
});

//新增临时文件
weChat.mediaBin.addTemporary("D:\\github\\node-wechat\\example\\file\\2.png", "image")
    .then(function (res) {
        console.log(res);
    })
    .catch(function (err) {
        console.log(err);
    });
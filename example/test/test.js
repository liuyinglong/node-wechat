let WeChat = require("../../src/index")

let weChat = new WeChat({
    appid: "",
    secret: "",
    token: ""
})

//新增临时文件
weChat.mp.createMpCode({
    scene: "1",
    page: "src/pages/index/index"
})
    .then(function (res) {
        console.log(res)
    })
    .catch(function (err) {
        console.error(err)
    })
## install 
```
npm install wechat-plus --save
```

## use

```js
//引入
var WeChat=require("wechat-plus");
let weChat= new WeChat({
    token: "your token",
    appid: "your appid",
    secret: "your secret",
});
  
//文字消息
weChat.event.on("weChat_msg_text", function (res, msg) {
    // msg接受到的消息内容
    // res对象
    // replay 方法 第一个参数为消息 第二个参数为消息类型 默认为text
    res.reply({
        ToUserName: msg.FromUserName,
        FromUserName: msg.ToUserName,
        Content: "ee"   //回复内容
    },"text");
});
  
//语音消息
weChat.event.on("weChat_msg_voice", function (res, msg) {
    // msg接受到的消息内容
    // res对象
    // replay 方法 第一个参数为消息 第二个参数为消息类型
    res.reply({
        ToUserName: msg.FromUserName,
        FromUserName: msg.ToUserName,
        Content: "ee"   //回复内容
    },"text");
}); 
   
/**
 * 生成授权链接
 * @param redirectUrl
 * @param state 默认为空
 * @param scope 默认为"snsapi_userinfo"
 * @returns {string}
 */
let authUrl=weChat.authUrl("http://youAddress.com/code","STATE","snsapi_userinfo")
  
/**
 * 获取用户信息
 * @param code
 * @returns {Promise.<TResult>|Request}
 */
weChat.getUserInfo("CODE").then(function(res){
    //userInfo 为res.body
});


/**
 * 生成jsSDK签名
 * @param url 链接地址
 * @returns {Promise.<TResult>}
 *                 noncestr:随机字符串,
                   timestamp: 时间戳,
                   signature: 签名
 */

weChat.jssdkSignature("url").then(function(result){
    
})


```

/**
 * Created by focus on 2017/5/8.
 */
let tools = require("./tools");
let parseString = require('xml2js').parseString;
let EventEmitter = require('events').EventEmitter;
let emitter = new EventEmitter();

let request = require("./request");

let WeChat = function (config) {
    this.token = config.token;
    this.appid = config.appid;
    this.secret = config.secret;
    this.event = emitter;
    this.request = request;
    this.accessToken = null;    //7200更新
    this.jsapiTicket = null;    //7200更新
    this.info = {
        appid: this.appid,
        secret: this.secret
    }
};

WeChat.prototype = {
    /**
     * 带auth的请求
     * 带secret向微信服务器发起请求。
     * @param url
     * @param body
     * @returns {*|Request}
     */
    fetchAuthGet: function (url, body) {
        return this.request.get(url, Object.assign(body, this.info))
    },
    
    /**
     * 普通请求
     * @param url
     * @param body
     * @returns {*|Request}
     */
    fetchGet: function (url, body) {
        return this.request.get(url, body)
    },
    
    /**
     * 普通post请求
     * @param url
     * @param body
     * @returns {Request|*}
     */
    fetchPost: function (url, body) {
        return this.request.post(url, body)
    },
    
    /**
     * 带accessToken的请求
     * @param url
     * @param body
     * @returns {*}
     */
    fetchToken: function (url, body, method = "GET") {
        let self = this;
        if (!this.accessToken || !this.accessToken.access_token || parseInt(Date.now()) - this.accessToken.timestamp < 200) {
            return this.getAccessToken().then(function () {
                return self.fetchToken(url, body, method);
            });
        } else {
            if (method === "GET") {
                return this.fetchGet(url, Object.assign(body, {
                    access_token: this.accessToken.access_token
                }))
            } else {
                return this.fetchPost(url, Object.assign(body, {
                    access_token: this.accessToken.access_token
                }))
            }
        }
    },
    
    /**
     * 验证签名
     * @param req
     * @returns {boolean}
     */
    auth: function (req) {
        let query = req.query;
        let tempSignature = this.generateSign(query.timestamp, query.nonce).signature;
        return tempSignature === query.signature;
    },
    
    /**
     * 生成签名
     * @param timestamp
     * @param nonce
     * @returns {{signature: *}}
     */
    generateSign: function (timestamp, nonce) {
        timestamp = timestamp ? timestamp : parseInt(Date.now() / 1000);
        nonce = nonce ? nonce : Math.random();
        let tempAry = [timestamp, nonce, this.token].sort();
        
        return {
            signature: tools.sha1(tempAry.join("")),
            timestamp: timestamp,
            nonce: nonce
        };
    },
    
    /**
     * 接收消息
     * @param req
     * @param res
     */
    userMessage: function (req, res) {
        let temp = "";
        let self = this;
        res.reply = self.reply.bind(res);
        req.on("data", function (chunk) {
            temp = temp + chunk;
        });
        
        req.on("end", function () {
            parseString(temp, {explicitArray: false}, function (err, result) {
                if (err) return;
                let msg = result.xml;
                switch (msg.MsgType) {
                    case "text"://文本消息
                        self.event.emit("weChat_msg_text", res, msg);
                        self.msgEventListen("weChat_msg_text", res, msg);
                        break;
                    case "voice"://语音消息
                        self.event.emit("weChat_msg_voice", res, msg);
                        self.msgEventListen("weChat_msg_voice", res, msg);
                        break;
                    case "event"://微信事件消息
                        self.event.emit("weChat_" + msg.Event, res, msg);
                        self.msgEventListen("weChat_" + msg.Event, res, msg);
                        break;
                    default:
                        self.event.emit("weChat_msg", res, msg);
                        break;
                }
            });
        });
    },
    
    /**
     * 监听事件的次数
     * 如果没有监听 则自动回复空内容
     * @param evenType
     * @param res
     */
    msgEventListen: function (evenType, res) {
        if (!EventEmitter.listenerCount(this.event, evenType)) {
            res.reply();
        }
    },
    
    
    /**
     * 回复消息
     * 此方法不可直接调用
     * 绑定在res对象上 this指向res
     * @param msg
     * @param type 消息类型
     */
    reply: function (msg, type = "text") {
        // 消息不存在 返回空消息
        if (!msg) {
            this.end();
            return;
        }
        //组合消息
        let resMsg = '<xml>' +
            '<ToUserName><![CDATA[' + msg.ToUserName + ']]></ToUserName>' +
            '<FromUserName><![CDATA[' + msg.FromUserName + ']]></FromUserName>' +
            '<CreateTime>' + parseInt(new Date().valueOf() / 1000) + '</CreateTime>' +
            '<MsgType><![CDATA[' + type + ']]></MsgType>' +
            '<Content><![CDATA[' + msg.Content + ']]></Content>' +
            '</xml>';
        //向微信服务器返回消息
        this.writeHead(200, {'Content-Type': 'application/xml'});
        this.end(resMsg);
    },
    
    /**
     * 生成授权链接
     * @param redirectUrl
     * @param state
     * @param scope
     * @returns {string}
     */
    authUrl: function (redirectUrl, state = "", scope = "snsapi_userinfo") {
        let stateString = state ? "&state=" + state : "";
        return "https://open.weixin.qq.com/connect/oauth2/authorize?appid=" + this.appid + "&redirect_uri=" + encodeURIComponent(redirectUrl) + "&response_type=code&scope=" + scope + stateString + "#wechat_redirect"
    },
    
    /**
     * 获取access_token
     * 首先请注意，这里通过code换取的是一个特殊的网页授权access_token,与基础支持中的access_token（该access_token用于调用其他接口）不同。
     * 公众号可通过下述接口来获取网页授权access_token。如果网页授权的作用域为snsapi_base，则本步骤中获取到网页授权access_token的同时，也获取到了openid，snsapi_base式的网页授权流程即到此为止。
     * 尤其注意：由于公众号的secret和获取到的access_token安全级别都非常高，必须只保存在服务器，不允许传给客户端。后续刷新access_token、通过access_token获取用户信息等步骤，也必须从服务器发起
     * @param code
     * @returns {*}
     */
    getWebAuthAccessToken: function (code) {
        return this.fetchAuthGet("/sns/oauth2/access_token", {
            code: code,
            grant_type: "authorization_code"
        })
    },
    
    /**
     * 获取access_token
     * @param code
     * @returns {*}
     */
    getUserInfoByToken: function (authInfo) {
        return this.fetchGet("/sns/userinfo", {
            access_token: authInfo.access_token,
            openid: authInfo.openid
        })
    },
    
    /**
     * 获取用户信息
     * @param code
     * @returns {Promise.<TResult>|Request}
     */
    getUserInfo: function (code) {
        return this.getWebAuthAccessToken(code).then(function (res) {
            return this.getUserInfoByToken(res.body);
        }.bind(this))
    },
    
    /**
     * 获取 UnionID
     * @param code
     * @returns {Request|Promise.<TResult>}
     */
    getUnionID: function (code) {
        return this.getWebAuthAccessToken(code).then(function (res) {
            return this.fetchGet("/cgi-bin/user/info", {
                access_token: res.body.access_token,
                openid: res.body.openid,
                lang: "zh_CN"
            })
        }.bind(this))
    },
    
    /**
     * 获取accessToken
     * @returns {*}
     */
    getAccessToken: function () {
        let self = this;
        return this.fetchAuthGet("/cgi-bin/token", {
            "grant_type": "client_credential"
        }).then(function (data) {
            self.accessToken = data.body;
            self.accessToken.timestamp = parseInt(Date.now() / 1000);
        }).catch(function (err) {
            console.log(err);
        });
    },
    
    /**
     * 获取jsTicket
     * @returns {Promise.<T>}
     */
    getJSApiTicket: function () {
        let self = this;
        if (!this.jsapiTicket || parseInt(Date.now() / 1000) - this.jsapiTicket.timestamp < 200) {
            return this.fetchToken("/cgi-bin/ticket/getticket", {
                type: "jsapi"
            }).then(function (data) {
                self.jsapiTicket = data.body;
                self.jsapiTicket.timestamp = parseInt(Date.now() / 1000);
            });
        } else {
            return Promise.resolve();
        }
    },
    
    /**
     * jssdk构建字符串
     * @param args
     * @returns {string}
     */
    raw: function (args) {
        let keys = Object.keys(args);
        keys = keys.sort();
        let newArgs = {};
        keys.forEach(function (key) {
            newArgs[key.toLowerCase()] = args[key];
        });
        
        let string = '';
        for (let k in newArgs) {
            string += '&' + k + '=' + newArgs[k];
        }
        string = string.substr(1);
        return string;
    },
    
    /**
     * 随机字符串生成器
     * @returns {string}
     */
    createNonceStr: function () {
        return Math.random().toString(36).substr(2, 15);
    },
    
    /**
     * 时间戳 秒
     * @returns {string}
     */
    createTimestamp: function () {
        return parseInt(new Date().getTime() / 1000) + '';
    },
    
    /**
     * 生成jsSDK签名
     * @param url
     * @returns {Promise.<TResult>}
     */
    jssdkSignature: function (url) {
        let self = this;
        return this.getJSApiTicket().then(function () {
            let temp = {
                noncestr: self.createNonceStr(),
                jsapi_ticket: self.jsapiTicket.ticket,
                timestamp: self.createTimestamp(),
                url: decodeURIComponent(url)
            };
            let tempStr = self.raw(temp);
            return Promise.resolve({
                noncestr: temp.noncestr,
                timestamp: temp.timestamp,
                signature: tools.sha1(tempStr)
            })
        })
    },
    
    
    /**
     * 新增客服
     * @param service
     */
    addService: function (service) {
        return this.fetchToken("/customservice/kfaccount/add", service, "POST")
    },
    
    /**
     * 修改客服
     * @param service
     * @returns {*}
     */
    updateService: function (service) {
        return this.fetchToken("/customservice/kfaccount/update", service, "POST")
    },
    
    /**
     * 删除客服
     * @param service
     * @returns {*}
     */
    deleteService: function (service) {
        return this.fetchToken("/customservice/kfaccount/del", service, "POST")
    },
    
    /**
     * 上传客服头像
     */
    uploadHeadImg: function () {
        //customservice/kfaccount/uploadheadimg
    },
    
    /**
     * 获取客服列表
     * @returns {*}
     */
    getServiceList: function () {
        return this.fetchToken("/cgi-bin/customservice/getkflist");
    },
    
    /**
     * 发送客服消息
     * @param msgInfo
     * @returns {*}
     */
    serviceSend: function (msgInfo) {
        return this.fetchToken("/cgi-bin/message/custom/send", msgInfo, "POST");
    },
    
    
    upload: function (fileInfo) {
        ///cgi-bin/media/upload?access_token=ACCESS_TOKEN&type=TYPE
    }
};

module.exports = WeChat;
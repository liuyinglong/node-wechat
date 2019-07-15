/**
 * Created by focus on 2018/1/5.
 */
let tools = require("../tools/tools");

module.exports = class WxWeb {
    constructor(wxRequest, config) {
        this.wxRequest = wxRequest;
        this.appid = config.appid;
        this.secret = config.secret;
        this.jsapiTicket = {};
    }

    /**
     * 生成授权链接
     * @param redirectUrl
     * @param state
     * @param scope
     * @returns {string}
     */
    authUrl(redirectUrl, state = "", scope = "snsapi_userinfo") {
        let stateString = state ? "&state=" + state : "";
        return "https://open.weixin.qq.com/connect/oauth2/authorize?appid=" + this.appid + "&redirect_uri=" + encodeURIComponent(redirectUrl) + "&response_type=code&scope=" + scope + stateString + "#wechat_redirect"
    }

    /**
     * 获取access_token
     * 首先请注意，这里通过code换取的是一个特殊的网页授权access_token,与基础支持中的access_token（该access_token用于调用其他接口）不同。
     * 公众号可通过下述接口来获取网页授权access_token。如果网页授权的作用域为snsapi_base，则本步骤中获取到网页授权access_token的同时，也获取到了openid，snsapi_base式的网页授权流程即到此为止。
     * 尤其注意：由于公众号的secret和获取到的access_token安全级别都非常高，必须只保存在服务器，不允许传给客户端。后续刷新access_token、通过access_token获取用户信息等步骤，也必须从服务器发起
     * @param code
     * @returns {*}
     */
    getWebAuthAccessToken(code) {
        return new Promise((resolve, reject) => {
            this.wxRequest.http("/sns/oauth2/access_token", {
                params: {
                    appid: this.appid,
                    secret: this.secret,
                    code: code,
                    grant_type: "authorization_code"
                },
                success(res) {
                    resolve(res);
                },
                error(err) {
                    reject(err);
                }
            })
        })
    }

    /**
     * 获取用户详细信息
     * @param authInfo
     * @returns {*}
     */
    getUserInfoByToken(authInfo) {
        return new Promise((resolve, reject) => {
            this.wxRequest.http("/sns/userinfo", {
                params: {
                    access_token: authInfo.access_token,
                    openid: authInfo.openid
                },
                success(res) {
                    resolve(res);
                },
                error(err) {
                    reject(err);
                }
            });
        })
    }

    /**
     * 获取用户基本信息(UnionID机制)

     在关注者与公众号产生消息交互后，公众号可获得关注者的OpenID（加密后的微信号，每个用户对每个公众号的OpenID是唯一的。对于不同公众号，同一用户的openid不同）。公众号可通过本接口来根据OpenID获取用户基本信息，包括昵称、头像、性别、所在城市、语言和关注时间。

     请注意，如果开发者有在多个公众号，或在公众号、移动应用之间统一用户帐号的需求，需要前往微信开放平台（open.weixin.qq.com）绑定公众号后，才可利用UnionID机制来满足上述需求。

     UnionID机制说明：

     开发者可通过OpenID来获取用户基本信息。特别需要注意的是，如果开发者拥有多个移动应用、网站应用和公众帐号，可通过获取用户基本信息中的unionid来区分用户的唯一性，因为只要是同一个微信开放平台帐号下的移动应用、网站应用和公众帐号，用户的unionid是唯一的。换句话说，同一用户，对同一个微信开放平台下的不同应用，unionid是相同的。
     * @param authInfo
     * @returns {*}
     */
    getUserInfoUnionId(authInfo) {
        return Promise((resolve, reject) => {
            this.wxRequest.http("/cgi-bin/user/info", {
                params: {
                    access_token: authInfo.access_token,
                    openid: authInfo.openid,
                    lang: "zh_CN"
                },
                success(res) {
                    resolve(res);
                },
                error(err) {
                    reject(err);
                }
            })
        })
    }

    /**
     * 获取用户信息（openID）
     * @param code
     * @returns {Promise.<TResult>}
     */
    getUserInfo(code) {
        return this.getWebAuthAccessToken(code).then((res) => {
            return this.getUserInfoByToken(res);
        })
    }


    /**
     * 获取 UnionID
     * @param code
     * @returns {Request|Promise.<TResult>}
     */
    getUnionID(code) {
        return this.getWebAuthAccessToken(code).then((res) => {
            return this.getUserInfoUnionId(res)
        })
    }

    /**
     * 获取jsTicket
     * @returns {Promise.<T>}
     */
    getJSApiTicket() {
        if (!this.jsapiTicket.ticket || Math.floor(Date.now() / 1000) - this.jsapiTicket.timestamp < 200) {
            return new Promise((resolve, reject) => {
                this.wxRequest.http("/cgi-bin/ticket/getticket", {
                    needAccessToken: true,
                    params: {
                        type: "jsapi"
                    },
                    success: (res) => {
                        this.jsapiTicket.timestamp = Date.now();
                        this.jsapiTicket.ticket = res.ticket;
                        resolve(this.jsapiTicket.ticket);
                    },
                    error(err) {
                        reject(err);
                    }
                });
            })

        }
        return Promise.resolve(this.jsapiTicket.ticket);
    }

    /**
     * jssdk构建字符串
     * @param args
     * @returns {string}
     */
    raw(args) {
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
    }

    static createNonceStr() {
        return Math.random().toString(36).substr(2, 15);
    }


    static createTimestamp() {
        return Math.floor(Date.now() / 1000) + '';
    }


    /**
     * 生成jsSDK签名
     * @param url
     * @returns {Promise<{signature: (*|string), noncestr, timestamp} | never>}
     */
    jssdkSignature(url) {

        return this.getJSApiTicket().then(
            () => {
                let temp = {
                    noncestr: WxWeb.createNonceStr(),
                    jsapi_ticket: this.jsapiTicket.ticket,
                    timestamp: WxWeb.createTimestamp(),
                    url: url
                };


                let tempStr = this.raw(temp);
                return {
                    appId: this.appid,
                    nonceStr: temp.noncestr,
                    timestamp: temp.timestamp,
                    signature: tools.sha1(tempStr)
                }
            })
    }
};
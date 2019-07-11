/**
 * Created by focus on 2018/1/5.
 */



let tools = require("../tools/tools");
let request = require("request");


module.exports = class WxRequest {
    constructor(config) {
        this.token = config.token;
        this.appid = config.appid;
        this.secret = config.secret;
        this.accessToken = null;      //7200更新
        this.jsapiTicket = null;      //7200更新
        this.tokenReqList = [];   //需要token的请求
        this.tokenState = 0;          //token状态 0为正常 1为正在获取token 2为获取token失败
        this.serverUrl = "https://api.weixin.qq.com";
        this.info = {
            appid: this.appid,
            secret: this.secret
        }
    }


    constructUrl(url) {
        let urlReg = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
        if (urlReg.test(url)) {
            return url;
        }
        return this.serverUrl + url;
    }


    /**
     * 获取access_token
     */
    getAccessToken(cb) {
        this.tokenState = 1;
        this.http("/cgi-bin/token", {
            params: Object.assign(this.info, {
                "grant_type": "client_credential"
            }),
            success: (res) => {
                console.log(new Date() + "获取access_token:" + res.access_token);
                this.accessToken = res.access_token;
                this.tokenState = 0;
                for (let i = 0, len = this.tokenReqList.length; i < len; i++) {
                    this.tokenReqList.shift()();
                }
                cb && cb();
            },
            error: (err) => {
                console.log(new Date() + "获取access_token:" + err);
                throw Error(err);
            }
        });
    }

    /**
     * 生成签名
     * @param timestamp
     * @param nonce
     * @returns {{signature: *}}
     */
    generateSign(timestamp, nonce) {
        timestamp = timestamp ? timestamp : parseInt(Date.now() / 1000);
        nonce = nonce ? nonce : Math.random();
        let tempAry = [timestamp, nonce, this.token].sort();
        return {
            signature: tools.sha1(tempAry.join("")),
            timestamp: timestamp,
            nonce: nonce
        };
    }


    objToUrl(obj) {
        let strAry = [];
        for (let k in obj) {
            strAry.push(k + "=" + obj[k]);
        }
        return strAry.join("&");
    }


    /**
     * 请求数据等
     * @param url
     * @param options
     */
    http(url, options) {
        let unReqOptions = ["method", "success", "error", "complete", "needAccessToken", "params"];
        let req = () => {
            let reqOptions = {};
            //需要accessToken
            if (options.needAccessToken) {
                if (!this.accessToken) {
                    this.tokenReqList.push(req);
                    if (this.tokenState === 0) {
                        this.getAccessToken();
                    }
                    return;
                }
                if (!options.params) {
                    options.params = {};
                }
                options.params.access_token = this.accessToken + "G";
            }
            //处理params
            if (options.params) {
                let queryString = this.objToUrl(options.params);
                let tempUrl = "";
                if (url.indexOf("?") > -1) {
                    tempUrl = url + queryString;
                } else {
                    tempUrl = this.serverUrl + url + "?" + queryString;
                }
                reqOptions.url = this.constructUrl(tempUrl);
            }
            let method = options.method || "get";
            for (let k in options) {
                let same = false;
                if (k === "formData") {
                    reqOptions.formData = options.formData();
                    continue;
                }
                for (let i = 0; i < unReqOptions.length; i++) {
                    if (k === unReqOptions[i]) {
                        same = true;
                        break;
                    }
                }
                if (!same) {
                    reqOptions[k] = options[k];
                }
            }
            request[method.toLocaleLowerCase()](reqOptions, (err, res) => {
                try {
                    res.body = JSON.parse(res.body);
                } catch (err) {

                }
                options.complete && options.complete(err, res);
                if (err) {
                    options.error && options.error({
                        error: err,
                        code: 500,
                        message: "无法连接到服务器"
                    });
                    return;
                }
                if (res.body && res.body["errcode"]) {
                    switch (res.body["errcode"]) {
                        case 40001:
                        case 41001:
                            if (options.needAccessToken) {
                                if (this.accessToken === options.params.access_token) {
                                    //获取access_token时AppSecret错误，或者access_token无效 此时从新获取token
                                    this.tokenReqList.push(req);
                                    if (this.tokenState === 0) {
                                        this.getAccessToken();
                                    }
                                } else {
                                    req();
                                }
                            } else {
                                options.error && options.error(res.body);
                            }
                            break;
                        default:
                            options.error && options.error(res.body);
                            break;
                    }
                    return;
                }
                options.success && options.success(res.body);
            });
        };
        req();
    }
};
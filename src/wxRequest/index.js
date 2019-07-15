/**
 * Created by focus on 2018/1/5.
 */



let tools = require("../tools/tools");
let axios = require("axios");
let qs = require("qs")


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
                while (this.tokenReqList.length) {
                    this.tokenReqList.shift()();
                }
                cb && cb();
            },
            error: (err) => {
                console.error(new Date() + "获取access_token:");
                console.error(err)
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
        timestamp = timestamp ? timestamp : Math.floor(Date.now() / 1000);
        nonce = nonce ? nonce : Math.random();
        let tempAry = [timestamp, nonce, this.token].sort();
        return {
            signature: tools.sha1(tempAry.join("")),
            timestamp: timestamp,
            nonce: nonce
        };
    }


    /**
     *
     * @param obj
     * @returns {string}
     */
    static objToUrl(obj) {
        let strAry = [];
        for (let k in obj) {
            strAry.push(k + "=" + obj[k]);
        }
        return strAry.join("&");
    }


    formatOptions(options) {
        //分离私有options和axios的options
        let privateKeySet = new Set([
            "success", "error", "complete", "needAccessToken", "emulateJSON"
        ])

        let privateOptions = {}
        let requestOptions = {}
        for (let key in options) {
            if (!options.hasOwnProperty(key)) {
                continue
            }
            if (privateKeySet.has(key)) {
                privateOptions[key] = options[key]
            } else {
                requestOptions[key] = options[key]
            }
        }

        if (typeof privateOptions.emulateJSON === "undefined") {
            privateOptions.emulateJSON = true
        }

        //请求地址
        requestOptions.url = this.constructUrl(requestOptions.url)

        //axios request token
        let CancelToken = axios.CancelToken
        let source = CancelToken.source()
        requestOptions.cancelToken = source.token

        //query参数
        requestOptions.params = Object.assign({}, requestOptions.params)

        return {
            privateOptions,
            requestOptions,
            source
        }
    }


    /**
     * 请求数据等
     * @param url
     * @param options
     */
    http(url, options) {
        if (typeof url === "object") {
            options = url
        } else {
            options.url = url
        }

        //格式化options
        let {requestOptions, privateOptions, source} = this.formatOptions(options)

        //请求体
        requestOptions.data = Object.assign({}, privateOptions.body, requestOptions.data)

        //使用'content-type': 'application/x-www-form-urlencoded'进行请求
        if (privateOptions.emulateJSON) {
            let headers = {'content-type': 'application/x-www-form-urlencoded'}
            requestOptions.headers = Object.assign(headers, requestOptions.headers)
            requestOptions.data = qs.stringify(requestOptions.data)
        }

        let req = () => {
            //需要accessToken
            if (privateOptions.needAccessToken) {
                if (!this.accessToken) {
                    this.tokenReqList.push(req);
                    if (this.tokenState === 0) {
                        this.getAccessToken();
                    }
                    return;
                }
                requestOptions.params = Object.assign({}, requestOptions.params)
                requestOptions.params.access_token = this.accessToken;
            }



            axios(requestOptions).then((res) => {
                let {data} = res

                privateOptions.complete && privateOptions.complete(res);
                if (data && data["errcode"]) {
                    switch (data["errcode"]) {
                        case 40001:
                        case 41001:
                            if (privateOptions.needAccessToken) {
                                if (this.accessToken === requestOptions.params.access_token) {
                                    //获取access_token时AppSecret错误，或者access_token无效 此时从新获取token
                                    this.tokenReqList.push(req);
                                    if (this.tokenState === 0) {
                                        this.getAccessToken();
                                    }
                                } else {
                                    req();
                                }
                            } else {
                                privateOptions.error && privateOptions.error(data);
                            }
                            break;
                        default:
                            privateOptions.success && privateOptions.success(data);
                            break;
                    }
                    return
                }
                privateOptions.success && privateOptions.success(data);
            }, (err) => {
                privateOptions.error && privateOptions.error({
                    error: err,
                    code: 500,
                    message: "无法连接到服务器"
                });
            });
        };
        req();
    }
}


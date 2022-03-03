/**
 * Created by focus on 2018/1/5.
 */



let tools = require("../tools/tools")
let axios = require("axios")
let qs = require("qs")

module.exports = class WxRequest {
    constructor(config) {
        this.token = config.token
        this.appid = config.appid
        this.secret = config.secret
        this.accessToken = {    //7200秒更新
            accessToken: "",
            timestamp: 0
        }
        this.tokenReqList = []   //需要token的请求
        this.tokenState = 0          //token状态 0为正常 1为正在获取token
        this.serverUrl = "https://api.weixin.qq.com"
        this.info = {
            appid: this.appid,
            secret: this.secret
        }
    }


    constructUrl(url) {
        let urlReg = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/
        if (urlReg.test(url)) {
            return url
        }
        return this.serverUrl + url
    }


    /**
     * 获取access_token
     */
    getAccessToken({success, fail} = {}) {
        this.tokenState = 1
        this.http("/cgi-bin/token", {
            params: Object.assign(this.info, {
                "grant_type": "client_credential"
            }),
            success: (res) => {
                console.log(new Date() + "获取access_token:" + res.access_token)
                this.accessToken.accessToken = res.access_token
                this.accessToken.timestamp = Date.now()
                while (this.tokenReqList.length) {
                    this.tokenReqList.shift()()
                }
                success && success()
            },
            error: (err) => {
                console.log("获取accessToken失败",err)
                while (this.tokenReqList.length) {
                    this.tokenReqList.shift()(err)
                }
                fail && fail(err)
            },
            complete: () => {
                this.tokenState = 0
            }
        })
    }

    /**
     * 生成签名
     * @param timestamp
     * @param nonce
     * @returns {{signature: *}}
     */
    generateSign(timestamp, nonce) {
        timestamp = timestamp ? timestamp : Math.floor(Date.now() / 1000)
        nonce = nonce ? nonce : Math.random()
        let tempAry = [timestamp, nonce, this.token].sort()
        return {
            signature: tools.sha1(tempAry.join("")),
            timestamp: timestamp,
            nonce: nonce
        }
    }


    /**
     *
     * @param obj
     * @returns {string}
     */
    static objToUrl(obj) {
        let strAry = []
        for (let k in obj) {
            strAry.push(k + "=" + obj[k])
        }
        return strAry.join("&")
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
            let headers = {"content-type": "application/x-www-form-urlencoded"}
            requestOptions.headers = Object.assign(headers, requestOptions.headers)
            requestOptions.data = qs.stringify(requestOptions.data)
        }

        let req = (err) => {
            if(err){
                privateOptions.complete && privateOptions.complete(res)
                privateOptions.error && privateOptions.error(err)
                return
            }

            //需要accessToken
            if (privateOptions.needAccessToken) {
                //判断accessToken是否存在和过期，留出100秒的缓冲时间
                if (!this.accessToken.accessToken || Date.now() - this.accessToken.timestamp > 7100000) {
                    this.tokenReqList.push(req)
                    if (this.tokenState === 0) {
                        console.log(new Date(),"快失效获取token")
                        this.getAccessToken()
                    }
                    return
                }
                requestOptions.params = Object.assign({}, requestOptions.params, requestOptions.query)
                requestOptions.params.access_token = this.accessToken.accessToken
            }


            axios(requestOptions).then((res) => {
                let {data} = res
                console.log(data)

                //如果请求的是arrayBuffer但是返回值又不是arrayBuffer,则将arrayBuffer转为json
                if (requestOptions.responseType === "arraybuffer") {
                    if (!res.headers["content-disposition"]) {
                        data = JSON.parse(String.fromCharCode.apply(null, new Uint16Array(data))) //转化成json对象
                    }
                }

                //如果出现错误
                if (data && data["errcode"]) {
                    switch (data["errcode"]) {
                        case 40001:
                        case 41001:
                        case 42001:
                            if (privateOptions.needAccessToken) {
                                if (this.tokenState === 0) {
                                    if (this.accessToken === requestOptions.params.access_token) {
                                        //获取access_token时AppSecret错误，或者access_token无效 此时从新获取token
                                        this.tokenReqList.push(req)
                                        console.log(new Date(),"已失效获取token")
                                        this.getAccessToken()
                                    } else {
                                        req()
                                    }
                                }
                            } else {
                                privateOptions.complete && privateOptions.complete(res)
                                privateOptions.error && privateOptions.error(data)
                            }
                            break
                        default:
                            privateOptions.complete && privateOptions.complete(res)
                            privateOptions.error && privateOptions.error(data)
                            break
                    }
                    return
                }


                privateOptions.complete && privateOptions.complete(res)
                privateOptions.success && privateOptions.success(data)
            }, (err) => {
                privateOptions.error && privateOptions.error({
                    error: err,
                    code: 500,
                    message: "无法连接到服务器"
                })
            })
        }
        req()
    }
}


/**
 * Created by focus on 2018/1/5.
 */
let tools = require("../tools/tools")

module.exports = class WxWeb {
    constructor(wxRequest, config) {
        this.wxRequest = wxRequest
        this.appid = config.appid
        this.secret = config.secret
        this.jsapiTicket = {
            ticket: "",
            timestamp: 0
        }
    }

    jscode2session({code}) {
        return new Promise(((resolve, reject) => {
            this.wxRequest.http({
                url: "/sns/jscode2session",
                params: {
                    appid: this.appid,
                    secret: this.secret,
                    js_code: code,
                    grant_type: "authorization_code"
                },
                success: (res) => {
                    resolve(res)
                },
                error: (err) => {
                    reject(err)
                }
            })
        }))
    }

    createMpCode(option) {
        return new Promise((resolve, reject) => {
            this.wxRequest.http({
                url: "/wxa/getwxacodeunlimit",
                method: "POST",
                data: option,
                responseType: 'arraybuffer',
                emulateJSON: false,
                needAccessToken: true,
                success: (data) => {
                    resolve(data)
                },
                fail: (error) => {
                    reject(error)
                }
            })
        })
    }

    msgSecCheck(content) {
        return new Promise((resolve, reject) => {
            this.wxRequest.http({
                url: "/wxa/msg_sec_check",
                method: "POST",
                data: {content},
                emulateJSON: false,
                needAccessToken: true,
                success: (data) => {
                    resolve(data)
                },
                fail: (error) => {
                    reject(error)
                }
            })
        })
    }
}
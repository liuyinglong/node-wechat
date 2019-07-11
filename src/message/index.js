/**
 * Created by focus on 2018/1/5.
 */


let parser = require('xml2js');
let EventEmitter = require('events').EventEmitter;
let emitter = new EventEmitter();

class WxMessage {
    constructor(wxRequest) {
        this.wxRequest = wxRequest;
        this.event = emitter;
    }

    /**
     * 微信接口配置信息
     * @param req
     * @param res
     * @returns {*}
     */
    checkSignature(req, res) {
        let signature = this.wxRequest.generateSign(req.query.timestamp, req.query.nonce).signature;
        if (req.query.signature === signature) {
            return res.send(req.query.echostr);
        } else {
            return false;
        }
    }


    userMessage(options) {
        return function (req, res, next) {
            let response = function (responseMsg) {
                //向微信服务器返回消息
                res.writeHead(200, {'Content-Type': 'application/xml'});
                res.end(responseMsg);
            }


            let xmlInfo = "";
            req.on("data", function (chunk) {
                xmlInfo = xmlInfo + chunk;
            })
            req.on("end", () => {
                parser.parseString(xmlInfo, {explicitArray: false}, (err, result) => {

                    let requestMsg = result.xml;
                    let responseMsg = null

                    //处理普通消息
                    if (requestMsg.MsgType === "event") {
                        if (options["event"]) {
                            let eventCb = options["event"][requestMsg.Event]
                            if (eventCb) {
                                responseMsg = eventCb(responseMsg)
                            }
                        }
                    }

                    //处理事件消息
                    if (requestMsg.MsgType !== "event") {
                        if (options["message"]) {
                            let messageCb = options["message"][requestMsg.MsgType]
                            if (messageCb) {
                                responseMsg = messageCb(requestMsg)
                            }
                        }
                    }

                    if (!responseMsg && options["default"]) {
                        responseMsg = options["default"](requestMsg)
                    }

                    if (!responseMsg) {
                        response()
                        return
                    }

                    responseMsg.CreateTime = Math.floor(Number(Date.now() / 1000));
                    responseMsg.MsgType = responseMsg.MsgType || "text";
                    let xmlInfo = '';
                    Object.keys(responseMsg).forEach((key) => {
                        xmlInfo = xmlInfo + `<${key}><![CDATA[${responseMsg[key]}]]></${key}>`
                    })
                    xmlInfo = `<xml>${xmlInfo}</xml>`;
                    response(xmlInfo)
                });
            })
        }
    }
}

module.exports = WxMessage;
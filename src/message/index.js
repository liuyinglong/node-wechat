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
    
    
    /**
     * 接收消息
     * @param req
     * @param res
     * @param cb 如果传入回调函数，则执行回调函数
     */
    userMessage(req, res, cb) {
        let temp = "";
        let self = this;
        res.reply = self.reply.bind(res);
        req.on("data", function (chunk) {
            temp = temp + chunk;
        });
        req.on("end", function () {
            parser.parseString(temp, {
                explicitArray: false
            }, function (err, result) {
                if (err) return;
                let msg = result.xml;
                if (cb) {
                    cb && cb(msg, res);
                    return;
                }
                //发布接受消息事件
                self.event.emit(`wx-${msg.MsgType}`, msg, res);
                self.msgEventListen(`wx-${msg.MsgType}`, msg, res);
            });
        });
    }
    
    /**
     * 监听事件的次数
     * 如果没有监听 则自动回复空内容
     * @param evenType
     * @param res
     */
    msgEventListen(evenType, res) {
        if (!EventEmitter.listenerCount(this.event, evenType)) {
            res.reply();
        }
    }
    
    
    /**
     * 回复消息
     * 此方法不可直接调用
     * 绑定在res对象上 this指向res
     * @param msg
     * @param type 消息类型
     */
    reply(msg, type = "text") {
        // 消息不存在 返回空消息
        if (!msg) {
            this.end();
            return;
        }
        msg.CreateTime = parseInt(new Date().valueOf() / 1000);
        msg.MsgType = msg.MsgType ? msg.MsgType : type;
        let xmlInfo = '';
        for (let key in msg) {
            xmlInfo = xmlInfo + `<${key}><![CDATA[${msg[key]}]]></${key}>`
        }
        xmlInfo = `<xml>${xmlInfo}</xml>`;
        //向微信服务器返回消息
        this.writeHead(200, {'Content-Type': 'application/xml'});
        this.end(xmlInfo);
    }
}

module.exports = WxMessage;
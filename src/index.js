/**
 * Created by focus on 2017/5/8.
 */


let Web = require("./web/index");
let Message = require("./message/index");
let WxRequest = require("./wxRequest/index");
let MediaBin = require("./media/index");

class WeChat {
    constructor(config) {
        this.wxRequest = new WxRequest(config);
        this.message = new Message(this.wxRequest);
        this.web = new Web(this.wxRequest,config);
        this.mediaBin = new MediaBin(this.wxRequest);
    }
}

module.exports = WeChat;
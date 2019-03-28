/**
 * Created by focus on 2018/1/12.
 * 素材管理
 */
let FormData = require('form-data');
let fs = require("fs");
let path = require("path");


class MediaBin {
    constructor(wxRequest) {
        this.wxRequest = wxRequest;
    }
    
    /**
     * 新增临时素材
     * 媒体文件类型，分别有图片（image）、语音（voice）、视频（video）和缩略图（thumb）
     * @param filePath 文件路径
     * @param type  文件type
     * @returns {*}
     */
    addTemporary(filePath, type) {
        let formData = new FormData();
        filePath = path.normalize(filePath);
        formData.append('media', fs.createReadStream(filePath));
        return new Promise((resolve, reject) => {
            this.wxRequest.http("/cgi-bin/media/upload", {
                needAccessToken: true,
                params: {
                    type: type
                },
                method: "post",
                formData: function () {
                    return {
                        media: fs.createReadStream(filePath)
                    }
                },
                success(res) {
                    resolve(res);
                },
                error(err) {
                    reject(err);
                }
            })
        });
        
    }
    
    /**
     * 获取临时素材
     * @param filePath 文件的路径,精确到扩展名
     * @param media_id
     */
    getTemporary(filePath, media_id){
        return new Promise((resolve, reject) => {
            this.wxRequest.http("/cgi-bin/media/get", {
                needToken: true,
                params: {
                    media_id: media_id
                },
                success(res) {
                    resolve(res);
                },
                error(err) {
                    reject(err);
                }
            })
        });
    }
}


module.exports = MediaBin;
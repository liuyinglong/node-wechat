/**
 * Created by focus on 2017/5/8.
 */
var crytpo = require("crypto");


module.exports = {
    sha1: function (str) {
        var hash = crytpo.createHash("sha1");
        hash.update(str);
        return hash.digest('hex');
    }
};
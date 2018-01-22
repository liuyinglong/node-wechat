/**
 * Created by focus on 2017/5/8.
 */
let crytpo = require("crypto");


module.exports = {
    sha1: function (str) {
        let hash = crytpo.createHash("sha1");
        hash.update(str);
        return hash.digest('hex');
    }
};
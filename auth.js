'use strict';

var config = require('./config'),
    db = require('./db');

var sqlConnection = db.sqlConnection();

// Auth
exports.auth = function(req, res, next) {
    var auth = req.session.auth;
    if (req.query && req.query.apiuser) {
        auth = req.session.auth = new Buffer(req.query.apiuser, 'base64').toString()
    }
    var referer = req.session.referer;
    if (referer == null && req.headers.referer) {
        referer = req.session.referer = req.headers.referer.split('/')[2];
    }
    sqlConnection.query('SELECT * FROM `apiauth` WHERE `username`=?', [auth], function (err, rows, fields) {
        if (rows.length > 0) {
            var referers = null;
            if (rows[0].urls !== null) {
                referers = rows[0].urls.split(',');
            }
            console.log(referers);
            console.log(auth);
            if (referers === null || referers.indexOf(referer) !== -1) {
                next();
            } else {
                delete req.session.auth;
                delete req.session.referer;
                res.statusCode = 401;
                res.end('Unauthorized');
            }
        } else {
            delete req.session.auth;
            delete req.session.referer;
            res.statusCode = 404;
        }
    });
};

// Msg
exports.msg = function (req, res) {
    res.render('auth-msg', {'sitename':req.params.sitename,'scheme':req.params.scheme,'port':req.params.port});
    delete req.session.auth;
    delete req.session.referer;
};
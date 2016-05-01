'use strict';

var config = require('./config'),
    db = require('./db');

// Auth
exports.auth = function(req, res, next) {
    var sqlConnection = db.sqlConnection();
    var auth = req.session.auth;
    if (req.query && req.query.apiuser) {
        auth = req.session.auth = new Buffer(req.query.apiuser, 'base64').toString()
    }
    var referer = req.session.referer;
    if (referer == null && req.headers.referer) {
        referer = req.session.referer = req.headers.referer.split('/')[2];
    }
    sqlConnection.query('SELECT * FROM `apiauth` WHERE `username`=?', [auth], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            var referers = null;
            if (rows[0].urls !== null) {
                referers = rows[0].urls.split(',');
            }
            if (referers === null || referers === "" || referers.indexOf(referer) !== -1) {
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

// Redirect
exports.rdr = function (req, res) {
    var redirectUrl = req.params.scheme + '://' + req.params.sitename
    if (req.params.port !== 'undefined') {
        redirectUrl += ':' + req.params.port;
    }
    redirectUrl += '/';
    if (req.query.path) {
        redirectUrl += req.query.path;
    }
    redirectUrl += '?token=' + req.session.id;
    res.redirect(redirectUrl)
    delete req.session.auth;
    delete req.session.referer;
};
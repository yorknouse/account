'use strict';

var config = require('./config'),
    db = require('./db');

var jade = require('jade');

// Auth
exports.auth = function (req, res, next) {
    var authorization = req.headers.authorization;
    if (!authorization) return authUnauth(res);
    
    var parts = authorization.split(' ');
    if (parts.length !== 2) return next(error(400));
    var scheme = parts[0],
        credentials = new Buffer(parts[1], 'base64').toString();
    if ('Public' != scheme) return next(error(400));
    var user = credentials;
    
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `apiauth` WHERE `username`=?', [user], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            var referers = null;
            if (rows[0].urls !== null) {
                referers = rows[0].urls.split(',');
            }
            if (referers === null || (req.headers.referer && referers.indexOf(req.headers.referer.split('/')[2]) !== -1)) {
                res.header('Access-Control-Allow-Origin', req.headers.origin);
                res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Authorization, Cookie');
                res.header('Access-Control-Allow-Credentials', 'true');
                next();
            } else {
                return authUnauth(res);
            }
        } else {
            return authUnauth(res);
        }
    });
};

var authUnauth = function (res, realm) {
  res.statusCode = 401;
  res.end('Unauthorized');
};

// Shortname
exports.shortnameOptions = function (req, res) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Authorization, Cookie');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.send();
};

exports.shortnameGet = function (req, res) {
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `content` WHERE `shortname`=?', [req.params.shortname], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            if (req.isAuthenticated() && req.user._activated > 2 && rows[0].login !== '') {
                // Show logged-in view
                res.send(jade.render(rows[0].login, {'req':req}));
            } else if (rows[0].logout !== '') {
                // Show logged-out view
                res.send(jade.render(rows[0].logout, {'req':req}));
            } else {
                var dest = req.session.dest;
                if (!dest) {
                    dest = req.session.dest = req.originalUrl;
                }
                res.redirect('/login');
            }
        } else {
            return error(404);
        }
    });
};

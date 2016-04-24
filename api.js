'use strict';

var config = require('./config'),
    db = require('./db');

var sqlConnection = db.sqlConnection(),
    md5 = require('js-md5');

// API auth
exports.auth = function (req, res, next) {
    var authorization = req.headers.authorization;
    if (!authorization) return apiAuthUnauth(res);
    
    var parts = authorization.split(' ');
    if (parts.length !== 2) return next(error(400));
    var scheme = parts[0],
        credentials = new Buffer(parts[1], 'base64').toString(),
        index = credentials.indexOf(':');
    if ('Basic' != scheme || index < 0) return next(error(400));
    var user = credentials.slice(0, index),
        pass = credentials.slice(index + 1);
    
    sqlConnection.query('SELECT * FROM `apiauth` WHERE `username`=?', [user], function (err, rows, fields) {
        if (rows.length > 0) {
            if (rows[0].password == md5(pass)) {
                var referers = null;
                if (rows[0].urls !== null) {
                    referers = rows[0].urls.split(',');
                }
                if (referers === null || (req.headers.referer && referers.indexOf(req.headers.referer.split('/')[2]) !== -1)) {
                    next();
                } else {
                    return authUnauth(res);
                }
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
  res.setHeader('WWW-Authenticate', 'Basic realm="Authorization required"');
  res.end('Unauthorized');
};

// API calls
exports.currentUser = function (req, res) {
    res.type('application/json');
    res.send({'id':req.user.id, 'email':req.user.emails[0].value, 'displayName':req.user.displayName});
};

exports.user = function (req, res) {
    // As this exposes a username and email for anyone with a user id, it should only be made from a server
    sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.params.uid], function (err, rows, fields) {
        if (rows.length > 0) {
            res.type('application/json');
            res.send({'id':rows[0].idusers, 'email':rows[0].email, 'displayName':rows[0].nick});
        } else {
            res.statusCode = 404;
            res.end('Not found');
        }
    });
};

exports.userEmails = function (req, res) {
    sqlConnection.query('(SELECT `email` FROM `googleauth` WHERE `idusers`=?) UNION (SELECT `email` FROM `fbauth` WHERE `idusers`=?) UNION (SELECT `email` FROM `localauth` WHERE `idusers`=?) UNION (SELECT `email` FROM `wpauth` WHERE `idusers`=?)', [req.params.uid, req.params.uid, req.params.uid, req.params.uid], function (err, rows, fields) {
        if (err == null && rows.length > 0) {
            var emails = [];
            for (var row in rows) {
                if (!req.params.domain || rows[row].email.endsWith(req.params.domain)) {
                    emails.push(rows[row].email);
                }
            }
            res.type('application/json');
            res.send(emails);
        } else {
            res.statusCode = 404;
            res.end('Not found');
        }
    });
};

exports.name = function (req, res) {
    res.type('application/json');
    res.send({'id':req.user.id, 'name':req.user.name, 'displayName':req.user.displayName});
};

exports.session = function (req, res) {
    sqlConnection.query('SELECT * FROM `sessions` WHERE `session_id`=?', [req.params.sessionid], function (err, rows, fields) {
        if (rows.length > 0) {
            res.type('application/json');
            var cookieobj = JSON.parse(rows[0].data);
            if (!cookieobj.passport.user) {
                res.statusCode = 403;
                res.end("{'error': 'No login'}");
            } else if (cookieobj.passport.user._activated < 3) {
                res.statusCode = 403;
                res.end("{'error': 'Suspended'}");
            } else {
                res.send({'userid': cookieobj.passport.user.id, 'displayName': cookieobj.passport.user.displayName, 'email': cookieobj.passport.user.emails[0].value});
            }
        } else {
            res.type('application/json');
            res.statusCode = 404;
            res.end("{'error': 'Not found'}");
        }
    });
};
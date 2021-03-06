'use strict';

var config = require('./config'),
    db = require('./db');

var fs = require('fs'),
    md5 = require('js-md5');

exports.abandon = function (req, res) {
    res.render('abandon');
};

exports.terms = function (req, res) {
    fs.readFile(config.termsFile, 'utf8', function (err, content) {
        if (err) return next(err);
        res.render('terms', {
            terms: content
        });
    });
};

exports.termsAccept = function (req, res) {
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("UPDATE `users` SET `activated`='3' WHERE `idusers`=?", [req.user.id], function (err, result) {
        sqlConnection.end();
        // Update the User object before redirecting
        var updatedUser = req.user;
        updatedUser._activated = 3;
        req.login(updatedUser, function (err) {
            if (updatedUser.displayName === null) {
                res.redirect('/account/nickname');
            } else {
                res.redirect('/continue');
            }
        });
    });
};

exports.termsReject = function (req, res) {
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("DELETE FROM `users` WHERE `idusers`=?", [req.user.id], function (err, result) {
        sqlConnection.end();
        req.logout();
        res.redirect('/signup/abandon');
    });
};

exports.validate = function (req, res) {
    res.render('validate');
};

exports.activate = function (req, res, next) {
    if(!req.query.id || !req.query.activate) {
        res.redirect('/login');
    } else {
        var sqlConnection = db.sqlConnection();
        sqlConnection.query('SELECT * FROM `localauth` WHERE `idusers`=?', [req.query.id], function (err, rows, fields) {
            sqlConnection.end();
            if (rows.length > 0) {
                if (md5(rows[0].activationcode) === req.query.activate) {
                    return next();
                } else {
                    res.redirect('/logout');
                }
            } else {
                // Should not be reached
                res.redirect('/logout');
            }
        });
    }
};

exports.activateConfirm = function (req, res) {
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("UPDATE `users` SET `activated`='2' WHERE `idusers`=?", [req.query.id], function (err, result) {
        sqlConnection.end();
        if (req.user && req.user.id == req.query.id) {
            req.user._activated = 2;
        }
        res.redirect('/continue');
    });
};
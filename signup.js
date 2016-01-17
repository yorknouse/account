'use strict';

var config = require('./config'),
    db = require('./db');

var fs = require('fs');

var sqlConnection = db.sqlConnection();

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
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `activated`='3' WHERE `idusers`='" + req.user.id + "'", function (err, result) {
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
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`users` WHERE `idusers`='" + req.user.id + "'", function (err, result) {
        req.logout();
        res.redirect('/signup/abandon');
    });
};

exports.validate = function (req, res) {
    res.render('validate');
};
'use strict';

var config = require('./config'),
    db = require('./db');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    FacebookStrategy = require('passport-facebook');

// Connect code for Google
exports.googleStrategy = new GoogleStrategy({
    callbackURL: config.root + '/connect/google/callback',
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    realm: config.root
}, function (accessToken, refreshToken, profile, done) {
    //Verify the callback
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `googleauth` WHERE `googid`=?', [profile.id], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            return done(null, false); // Account already in use so return false
        }
        // Account doesn't exist
        // We'll associate it with the current account next
        return done(null, profile);
    });
});

exports.googleCallback = function (req, res) {
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("INSERT INTO `googleauth` (`googid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.account.id, req.user.id, req.account.emails[0].value], function (err, result) {
        sqlConnection.end();
        if (err !== null) {
            // Should not be reached
            res.redirect('/connect?error=1');
        } else {
            res.redirect('/connect/continue');
        }
    });
};

// Connect code for Facebook
exports.facebookStrategy = new FacebookStrategy({
    clientID: config.facebookClientId,
    clientSecret: config.facebookClientSecret,
    callbackURL: config.root + '/connect/facebook/callback',
    profileFields: ['id', 'displayName', 'email', 'first_name', 'last_name']
}, function (accessToken, refreshToken, profile, done) {
    // Verify the callback
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `fbauth` WHERE `fbid`=?', [profile.id], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            return done(null, false); // Account already in use so return false
        }
        // Account doesn't exist
        // We'll associate it with the current account next
        return done(null, profile);
    });
});

exports.facebookCallback = function (req, res) {
    if (!req.account.emails || req.account.emails.length == 0 || req.account.emails[0].value.indexOf('@') == -1) {
        res.redirect('/connect/facebook/error');
    } else {
        var sqlConnection = db.sqlConnection();
        sqlConnection.query("INSERT INTO `fbauth` (`fbid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.account.id, req.user.id, req.account.emails[0].value], function (err, result) {
            sqlConnection.end();
            if (err !== null) {
                // Should not be reached
                res.redirect('/connect?error=1');
            } else {
                res.redirect('/connect/continue');
            }
        });
    }
};

exports.facebookError = function (req, res) {
    res.render('login-facebook-error', {connect: true});
}

// General connect code
exports.connect = function (req, res) {
    res.render('connect', {error: req.query.error?req.query.error:null});
};

exports.continue = function (req, res) {
    res.render('connect-continue');
}
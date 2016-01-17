'use strict';

var config = require('./config'),
    db = require('./db');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

var sqlConnection = db.sqlConnection();

// Generate profile from DB row
function generateProfile(row) {
    return {
        'provider': 'nouse',
        'id': row.idusers,
        'displayName': row.nick,
        'name': {
            'familyName': row.lname,
            'givenName': row.fname
        },
        'emails': [
            {
                'value': row.email,
                'type': 'account'
            }
        ],
        '_activated': row.activated
    };
}

// Login code for Google
exports.googleStrategy = new GoogleStrategy({
    callbackURL: config.root + '/login/google/callback',
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    realm: config.root
}, function (accessToken, refreshToken, profile, done) {
    //Verify the callback
    console.log('Google Login');
    sqlConnection.query('SELECT * FROM `googleauth` WHERE `googid`=?', [profile.id], function (err, rows, fields) {
        if (rows.length > 0) {
            return done(null, {'provider':'nouse-transition','id': rows[0].idusers, '_googleId': profile.id});
        }
        // Account doesn't exist
        // We'll create a new account later, so set the google account for now (/login/google/continue will understand)
        return done(null, profile);
    });
});

exports.googleContinue = function(req, res){
    console.log('Login Google Continue');
    if (req.user.provider == 'nouse-transition') {
        // User already exists so find and update to account
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            req.login(generateProfile(rows[0]), function(err) {
                console.log('Existing user logged in');
                res.redirect('/login/continue');
            });
        });
    } else {
        // Provider is Google, account needs to be created
        sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`users` (`fname`, `lname`, `email`, `activated`, `lastLogin`) VALUES ('" + req.user.name.givenName + "', '" + req.user.name.familyName + "', '" + req.user.emails[0].value + "', '2', NOW())", function (err, result) {
            console.log(err);
            if (err === null) {
                req.login({'provider':'nouse-transition','id':result.insertId, '_googleId':req.user.id, 'emails':[{'value':req.user.emails[0].value}]}, function(err) {
                    console.log('New User logged in');
                    res.redirect('/login/google/link');
                });
            } else {
                // Should never be reached
                res.redirect('/logout');
            }
        });
    }
};

exports.googleLink = function(req, res) {
    console.log('Login Google Link');
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`googleauth` (`googid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.user._googleId, req.user.id, req.user.emails[0].value], function (err, result) {
        if (err !== null) {
            // Should not be reached
            res.redirect('/logout');
        } else {
            res.redirect('/login/google/continue');
        }
    });
};

// General Login
exports.login = function (req, res) {
    res.render('login');
};

exports.continue = function(req, res) {
    console.log('Login Continue');
    // Update last login and continue
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `lastLogin`=NOW() WHERE `idusers`='" + req.user.id + "'", function (err, result) {
        res.redirect('/continue');
    });
};

// Logout
exports.logout = function (req, res) {
    req.logout();
    res.redirect('/');
};
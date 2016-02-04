'use strict';

var config = require('./config'),
    db = require('./db');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    LocalStrategy = require('passport-local'),
    FacebookStrategy = require('passport-facebook'),
    md5 = require('js-md5'),
    randomstring = require('randomstring'),
    sendgrid = require('sendgrid')(config.sendgridAPIkey),
    jade = require('jade');

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
    if (req.user.provider == 'nouse-transition') {
        // User already exists so find and update to account
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            req.login(generateProfile(rows[0]), function(err) {
                res.redirect('/login/continue');
            });
        });
    } else {
        // Provider is Google, account needs to be created
        sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`users` (`fname`, `lname`, `email`, `activated`, `lastLogin`) VALUES ('" + req.user.name.givenName + "', '" + req.user.name.familyName + "', '" + req.user.emails[0].value + "', '2', NOW())", function (err, result) {
            if (err === null) {
                req.login({'provider':'nouse-transition','id':result.insertId, '_googleId':req.user.id, 'emails':[{'value':req.user.emails[0].value}]}, function(err) {
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
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`googleauth` (`googid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.user._googleId, req.user.id, req.user.emails[0].value], function (err, result) {
        if (err !== null) {
            // Should not be reached
            res.redirect('/logout');
        } else {
            res.redirect('/login/google/continue');
        }
    });
};

// Login code for Facebook
exports.facebookStrategy = new FacebookStrategy({
    clientID: config.facebookClientId,
    clientSecret: config.facebookClientSecret,
    callbackURL: config.root + '/login/facebook/callback',
    profileFields: ['id', 'displayName', 'email', 'first_name', 'last_name']
}, function (accessToken, refreshToken, profile, done) {
    // Verify the callback
    sqlConnection.query('SELECT * FROM `fbauth` WHERE `fbid`=?', [profile.id], function (err, rows, fields) {
        if (rows.length > 0) {
            return done(null, {'provider':'nouse-transition','id': rows[0].idusers, '_fbId': profile.id});
        }
        // Account doesn't exist
        // We'll create a new account later, so set the facebook account for now (/login/facebook/continue will understand)
        return done(null, profile);
    });
});

exports.facebookContinue = function(req, res){
    if (req.user.provider == 'nouse-transition') {
        // User already exists so find and update to account
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            req.login(generateProfile(rows[0]), function(err) {
                res.redirect('/login/continue');
            });
        });
    } else {
        // Provider is Facebook, account needs to be created
        if (!req.user.emails || req.user.emails.length == 0 || req.user.emails[0].value.indexOf('@') == -1) {
            // Email permission declined, explain and re-request
            req.logout();
            res.redirect('/login/facebook/error');
        } else {
            sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`users` (`fname`, `lname`, `email`, `activated`, `lastLogin`) VALUES ('" + req.user.name.givenName + "', '" + req.user.name.familyName + "', '" + req.user.emails[0].value + "', '2', NOW())", function (err, result) {
                if (err === null) {
                    req.login({'provider':'nouse-transition','id':result.insertId, '_fbId':req.user.id, 'emails':[{'value':req.user.emails[0].value}]}, function(err) {
                        res.redirect('/login/facebook/link');
                    });
                } else {
                    // Should never be reached
                    res.redirect('/logout');
                }
            });
        }
    }
};

exports.facebookLink = function(req, res) {
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`fbauth` (`fbid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.user._fbId, req.user.id, req.user.emails[0].value], function (err, result) {
        if (err !== null) {
            // Should not be reached
            res.redirect('/logout');
        } else {
            res.redirect('/login/facebook/continue');
        }
    });
};

exports.facebookError = function (req, res) {
    res.render('login-facebook-error');
}


// Local login code
exports.localStrategy = new LocalStrategy(function (username, password, done) {
    // Find user in database
    sqlConnection.query('SELECT * FROM `localauth` WHERE `email`=?', [username], function (err, rows, fields) {
        if (rows.length > 0) {
            if (rows[0].password === md5(password + rows[0].salt)) {
                return done(null, {'provider':'nouse-transition','id': rows[0].idusers});
            } else {
                return done(null, false);
            }
        } else {
            if (err) return done(err, false);
            return done(null, false);
        }
    });
});

exports.localGet = function (req, res) {
    res.render('login-local', {error: req.query.error?req.query.error:null});
};

exports.localPost = function (req, res) {
    if (req.user.provider == 'nouse-transition') {
        // User already exists so find and update to account
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            req.login(generateProfile(rows[0]), function(err) {
                res.redirect('/login/continue');
            });
        });
    } else {
        res.redirect(303, '/login/local?error=1');
    }
};

// Local registration
exports.registerGet = function (req, res) {
    res.render('register', {error:req.query.error?req.query.error:null});
};

exports.registerPost = function (req, res, next) {
    if (req.body.password === req.body.confirm) {
        sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`users` (`fname`, `lname`, `email`, `lastLogin`) VALUES (?, ?, ?, NOW())", [req.body.fname, req.body.lname, req.body.username],function (err, result) {
            if (err === null) {
                req.login({'provider':'nouse-transition','id':result.insertId}, function(err) {
                    return next();
                });
            } else {
                console.log(err);
                res.redirect('/register?error=' + err.code);
            }
        });
    } else {
        res.redirect('/register?error=PASSWORD_MISMATCH');
    }
};

exports.registerLink = function (req, res, next) {
    var salt = randomstring.generate(30);
    var activationcode = randomstring.generate({length: 8, charset: 'numeric'});
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`localauth` (`email`, `password`, `salt`, `idusers`, `activationcode`) VALUES (?, ?, ?, ?, ?)", [req.body.username, md5(req.body.password + salt), salt, req.user.id, activationcode], function (err, result) {
        if (err === null) {
            var email = new sendgrid.Email({
                "to": req.body.username,
                "toname": req.body.fname + ' ' + req.body.lname,
                "from": config.supportEmail,
                "fromname": config.name,
                "subject": "Activate your " + config.name + " account",
                "html": jade.renderFile('template/register-activate-email.jade', {userid: req.user.id, code: activationcode, codehash: md5(activationcode), root: config.root, supportEmail: config.supportEmail})
            });
            sendgrid.send(email, function (err, json) {
                if (!err) return next();
                // Should not be reached
                res.redirect('/register?error' + err.code);
            });
        } else {
            console.log(err);
            // Should not be reached
            res.redirect('/register?error' + err.code);
        }
    });
};

exports.registerLogin = function (req, res) {
    sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
        req.login(generateProfile(rows[0]), function(err) {
            res.redirect('/register/activate');
        });
    });
};

exports.registerActivateGet = function (req, res) {
    res.render('register-activate', {error: req.query.error?req.query.error:null});
};

exports.registerActivatePost = function (req, res, next) {
    sqlConnection.query('SELECT * FROM `localauth` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
        if (rows.length > 0) {
            if (rows[0].activationcode === req.body.code) {
                return next();
            } else {
                res.redirect('/register/activate?error=1');
            }
        } else {
            // Should not be reached
            res.redirect('/logout');
        }
    });
};

exports.registerActivateConfirm = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `activated`='2' WHERE `idusers`=?", [req.user.id], function (err, result) {
        req.user._activated = 2;
        res.redirect('/continue');
    });
};

// General Login
exports.login = function (req, res) {
    res.render('login');
};

exports.continue = function(req, res) {
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
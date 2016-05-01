'use strict';

var config = require('./config'),
    db = require('./db');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    LocalStrategy = require('passport-local'),
    FacebookStrategy = require('passport-facebook'),
    WordpressStrategy = require('passport-wordpress').Strategy,
    md5 = require('js-md5'),
    randomstring = require('randomstring'),
    sendgrid = require('sendgrid')(config.sendgridAPIkey),
    jade = require('jade');

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
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `googleauth` WHERE `googid`=?', [profile.id], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            return done(null, {'provider':'nouse-transition','id': rows[0].idusers, '_googleId': profile.id});
        }
        // Account doesn't exist
        // We'll create a new account later, so set the google account for now (/login/google/continue will understand)
        return done(null, profile);
    });
});

exports.googleContinue = function(req, res){
    var sqlConnection = db.sqlConnection();
    if (req.user.provider == 'nouse-transition') {
        // User already exists so find and update to account
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            sqlConnection.end();
            req.login(generateProfile(rows[0]), function(err) {
                res.redirect('/login/continue');
            });
        });
    } else {
        // Provider is Google, account needs to be created
        sqlConnection.query("INSERT INTO `users` (`fname`, `lname`, `email`, `activated`, `lastLogin`) VALUES (?, ?, ?, '2', NOW())", [req.user.name.givenName, req.user.name.familyName, req.user.emails[0].value], function (err, result) {
            sqlConnection.end();
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
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("INSERT INTO `googleauth` (`googid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.user._googleId, req.user.id, req.user.emails[0].value], function (err, result) {
        sqlConnection.end();
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
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `fbauth` WHERE `fbid`=?', [profile.id], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            return done(null, {'provider':'nouse-transition','id': rows[0].idusers, '_fbId': profile.id});
        }
        // Account doesn't exist
        // We'll create a new account later, so set the facebook account for now (/login/facebook/continue will understand)
        return done(null, profile);
    });
});

exports.facebookContinue = function(req, res){
    var sqlConnection = db.sqlConnection();
    if (req.user.provider == 'nouse-transition') {
        // User already exists so find and update to account
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            sqlConnection.end();
            req.login(generateProfile(rows[0]), function(err) {
                res.redirect('/login/continue');
            });
        });
    } else {
        // Provider is Facebook, account needs to be created
        if (!req.user.emails || req.user.emails.length == 0 || req.user.emails[0].value.indexOf('@') == -1) {
            sqlConnection.end();
            // Email permission declined, explain and re-request
            req.logout();
            res.redirect('/login/facebook/error');
        } else {
            sqlConnection.query("INSERT INTO `users` (`fname`, `lname`, `email`, `activated`, `lastLogin`) VALUES (?, ?, ?, '2', NOW())", [req.user.name.givenName, req.user.name.familyName, req.user.emails[0].value], function (err, result) {
                sqlConnection.end();
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
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("INSERT INTO `fbauth` (`fbid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.user._fbId, req.user.id, req.user.emails[0].value], function (err, result) {
        sqlConnection.end();
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

// Login code for Wordpress
exports.wordpressStrategy = new WordpressStrategy({
    clientID: config.wordpressClientId,
    clientSecret: config.wordpressClientSecret,
    callbackURL: config.root + '/login/wordpress/callback',
    scope: ['auth']
}, function (accessToken, refreshToken, profile, done) {
    profile.id = profile._json.ID; // Fix a known issue (https://github.com/mjpearson/passport-wordpress/commit/8690ef2ff751299d5ea5b8caa1cca273884753c9) that hasn't made it to NPM yet
    // Now fix some undocumented issues with interpreting the information
    if (!profile.emails) profile.emails = []; // Email in correct format
    profile.emails.push({value: profile._json.email});
    if (!profile.name) profile.name = {
        givenName: profile.displayName.split(' ')[0],
        familyName: profile.displayName.split(' ')[profile.displayName.split(' ').length - 1]
    };
    
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `wpauth` WHERE `wpid`=?', [profile.id], function (err, rows, fields) {
        sqlConnection.end();
        if (rows.length > 0) {
            return done(null, {'provider':'nouse-transition','id': rows[0].idusers, '_wpId': profile.id});
        }
        // Account doesn't exist
        // We'll create a new account later, so set the wordpress account for now (/login/wordpress/continue will understand)
        return done(null, profile);
    });
});

exports.wordpressContinue = function(req, res){
    var sqlConnection = db.sqlConnection();
    if (req.user.provider == 'nouse-transition') {
        // User already exists so find and update to account
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            sqlConnection.end();
            req.login(generateProfile(rows[0]), function(err) {
                res.redirect('/login/continue');
            });
        });
    } else {
        // Provider is Wordpress, account needs to be created
        sqlConnection.query("INSERT INTO `users` (`fname`, `lname`, `email`, `activated`, `lastLogin`) VALUES (?, ?, ?, '2', NOW())", [req.user.name.givenName, req.user.name.familyName, req.user.emails[0].value], function (err, result) {
            sqlConnection.end();
            if (err === null) {
                req.login({'provider':'nouse-transition','id':result.insertId, '_wpId':req.user.id, 'emails':[{'value':req.user.emails[0].value}]}, function(err) {
                    res.redirect('/login/wordpress/link');
                });
            } else {
                // Should never be reached
                res.redirect('/logout');
            }
        });
    }
};

exports.wordpressLink = function(req, res) {
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("INSERT INTO `wpauth` (`wpid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.user._wpId, req.user.id, req.user.emails[0].value], function (err, result) {
        sqlConnection.end();
        if (err !== null) {
            // Should not be reached
            res.redirect('/logout');
        } else {
            res.redirect('/login/wordpress/continue');
        }
    });
};

// Local login code
exports.localStrategy = new LocalStrategy(function (username, password, done) {
    var sqlConnection = db.sqlConnection();
    // Find user in database
    sqlConnection.query('SELECT * FROM `localauth` WHERE `email`=?', [username], function (err, rows, fields) {
        sqlConnection.end();
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
        var sqlConnection = db.sqlConnection();
        sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
            sqlConnection.end();
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
        var sqlConnection = db.sqlConnection();
        sqlConnection.query("INSERT INTO `users` (`fname`, `lname`, `email`, `lastLogin`) VALUES (?, ?, ?, NOW())", [req.body.fname, req.body.lname, req.body.username],function (err, result) {
            sqlConnection.end();
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
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("INSERT INTO `localauth` (`email`, `password`, `salt`, `idusers`, `activationcode`) VALUES (?, ?, ?, ?, ?)", [req.body.username, md5(req.body.password + salt), salt, req.user.id, activationcode], function (err, result) {
        sqlConnection.end();
        if (err === null) {
            var email = new sendgrid.Email({
                "to": req.body.username.replace(/(<([^>]+)>)/ig,""),
                "toname": req.body.fname.replace(/(<([^>]+)>)/ig,"") + ' ' + req.body.lname.replace(/(<([^>]+)>)/ig,""),
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
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
        sqlConnection.end();
        req.login(generateProfile(rows[0]), function(err) {
            res.redirect('/register/activate');
        });
    });
};

exports.registerActivateGet = function (req, res) {
    res.render('register-activate', {error: req.query.error?req.query.error:null});
};

exports.registerActivatePost = function (req, res, next) {
    var sqlConnection = db.sqlConnection();
    sqlConnection.query('SELECT * FROM `localauth` WHERE `idusers`=?', [req.user.id], function (err, rows, fields) {
        sqlConnection.end();
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
    var sqlConnection = db.sqlConnection();
    sqlConnection.query("UPDATE `users` SET `activated`='2' WHERE `idusers`=?", [req.user.id], function (err, result) {
        sqlConnection.end();
        req.user._activated = 2;
        res.redirect('/continue');
    });
};

// General Login
exports.login = function (req, res) {
    res.render('login');
};

exports.continue = function(req, res) {
    var sqlConnection = db.sqlConnection();
    // Update last login and continue
    sqlConnection.query("UPDATE `users` SET `lastLogin`=NOW() WHERE `idusers`='" + req.user.id + "'", function (err, result) {
        sqlConnection.end();
        res.redirect('/continue');
    });
};

// Logout
exports.logout = function (req, res) {
    req.logout();
    res.redirect('/');
};
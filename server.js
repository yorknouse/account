'use strict';

// Import Modules

var config = require('./config');

var express = require('express'),
    path = require('path'),
    http = require('http'),
    session = require('express-session'),
    cookie = require('cookie-parser'),
    body = require('body-parser'),
    passport = require('passport'),
    mysql = require('mysql'),
    bodyparser = require('body-parser'),
    mysqlSessionStore = require('express-mysql-session'),
    fs = require('fs'),
    md5 = require('js-md5'),
    jade = require('jade'),
    sendgrid = require('sendgrid')(config.sendgridAPIkey);

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

var app = express();

app.set('port', process.env.PORT || 22360);
app.set('views', path.join(__dirname, 'template'));
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));

app.use(cookie());
app.use(bodyparser.urlencoded({'extended': true}));


// Set-up database access
var sqlConnection = mysql.createConnection({
    host: config.mysqlHost,
    user: config.mysqlUser,
    password: config.mysqlPass,
    database: config.mysqlDatabase,
    port: config.mysqlPort
});

sqlConnection.connect(function (err) {
    if (err) {
        console.log(err.stack);
        return;
    }
    
    console.log("Connected to database");
});

// Set-up session storage
var sessionStore = new mysqlSessionStore({}, sqlConnection);

app.use(session({
    key: '',
    secret: config.secret,
    cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: false
    },
    name: 'nacc-ses',
    resave: false,
    saveUninitialized: false,
    proxy: null,
    store: sessionStore
}));

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

// Login code
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    var dest = req.session.dest;
    if (!dest) {
        dest = req.session.dest = req.originalUrl;
    }
    res.redirect('/login');
}

function isActivatedUser(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user._activated > 2) {
            return next();
        } else if (req.user._activated === 2) {
            var dest = req.session.dest;
            if (!dest) {
                dest = req.session.dest = req.originalUrl;
            }
            res.redirect('/signup/terms');
        } else if (req.user._activated === 1) {
            res.redirect('/signup/validate');
        } else {
            res.redirect('/account/suspended');
        }
    } else {
        var dest = req.session.dest;
        if (!dest) {
            dest = req.session.dest = req.originalUrl;
        }
        res.redirect('/login');
    }
}

function isAdminUser(req, res, next) {
    // Must be used after isActivatedUser
    if (req.user._activated === 9) {
        return next();
    } else {
        res.redirect('/account');
    }
}

app.get('/login', function (req, res) {
    res.render('login');
})

// Login code for Google
passport.use(new GoogleStrategy({
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
}));

app.get('/login/google', passport.authenticate('google' , {
    scope: ['profile', 'email']
}));

app.get('/login/google/callback', passport.authenticate('google', {
    successRedirect: '/login/google/continue',
    failureRedirect: '/'
}));

app.get('/login/google/continue', function(req, res){
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
});

app.get('/login/google/link', function(req, res) {
    console.log('Login Google Link');
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`googleauth` (`googid`, `idusers`, `email`) VALUES (?, ?, ?)", [req.user._googleId, req.user.id, req.user.emails[0].value], function (err, result) {
        if (err !== null) {
            // Should not be reached
            res.redirect('/logout');
        } else {
            res.redirect('/login/google/continue');
        }
    });
});

app.get('/login/continue', function(req, res) {
    console.log('Login Continue');
    // Update last login and continue
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `lastLogin`=NOW() WHERE `idusers`='" + req.user.id + "'", function (err, result) {
        res.redirect('/continue');
    });
});

app.get('/continue', function(req, res) {
    var dest = req.session.dest;
    if (dest) {
        delete req.session.dest;
        res.redirect(dest);
    } else {
        res.redirect('/account');
    }
})

// Account signup

app.get('/signup/abandon', function (req, res) {
    res.render('abandon');
});

app.get('/signup/terms', isLoggedIn, function (req, res) {
    fs.readFile(config.termsFile, 'utf8', function (err, content) {
        if (err) return next(err);
        res.render('terms', {
            terms: content
        });
    });
});

app.get('/signup/terms/accept', isLoggedIn, function (req, res) {
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
});

app.get('/signup/terms/reject', isLoggedIn, function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`users` WHERE `idusers`='" + req.user.id + "'", function (err, result) {
        req.logout();
        res.redirect('/signup/abandon');
    });
});

app.get('/signup/validate', function (req, res) {
    res.render('validate');
});

// Logout code
app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

// Main pages
app.get('/', function (req, res) {
    res.render('index');
});

// Account Page
app.get('/account', isActivatedUser, function (req, res) {
    var i, emailAddr;
    for (i = 0; i < req.user.emails.length; i += 1) {
        emailAddr = req.user.emails[i].value;
    }
    var act = null;
    if (req.query.act) act = req.query.act;
    res.render('account', {'user': req.user, 'email': emailAddr, 'act': act});
});

app.get('/account/suspended', isLoggedIn, function (req, res) {
    res.render('suspended');
});

// Nickname configuration
app.get('/account/nickname', isActivatedUser, function (req, res) {
    res.render('nickname', {
        'nickname': req.user.displayName
    });
});

app.post('/account/nickname', isActivatedUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `nick`=? WHERE `idusers`='" + req.user.id + "'", [req.body.nickname], function (err, result) {
        // Update the User object before redirecting
        var updatedUser = req.user;
        updatedUser.displayName = sqlConnection.escape(req.body.nickname).split("'")[1];
        req.login(updatedUser, function (err) {
            res.redirect('/continue');
        });
    });
});

// Admin Pages
app.get('/admin', isActivatedUser, isAdminUser, function (req, res) {
    res.render('admin-index');
});

app.get('/admin/users', isActivatedUser, isAdminUser, function (req, res) {
    var low = 0, high = 1000;
    if (req.query.low) {
        low = parseInt(req.query.low);
    }
    if (req.query.high) {
        high = parseInt(req.query.high);
    }
    var field = null, q = null;
    if (req.query.field) {
        field = req.query.field;
    }
    if (req.query.q) {
        q = req.query.q;
    }
    sqlConnection.query('SELECT * FROM `users` ' + (field?'WHERE `' + field + '` LIKE ? ':'') + 'LIMIT ?, ?', field?[q, low, high]:[low, high], function (err, rows, fields) {
        if (err) throw err;
        res.render('admin-users', {rows: rows, low: low, high: high, activationStatus: config.userActivationStatus, field: field, q: q});
    });
});

app.get('/admin/users/suspend', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `activated`=0 WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        res.redirect(req.headers.referer);
    });
});
    
app.get('/admin/users/unsuspend', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `activated`=2 WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        res.redirect(req.headers.referer);
    });
});

app.get('/admin/users/delete', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `fname`='', `lname`='', `email`='', `activated`=0 WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        req.session.dest = req.headers.referer;
        res.redirect('/admin/users/delete/google?idusers=' + req.query.idusers);
    });
});

app.get('/admin/users/delete/google', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`googleauth` WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        res.redirect('/continue');
    });
});

app.get('/admin/users/edit/:userid', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.params.userid], function (err, rows, fields) {
         if (rows.length > 0) {
             res.render('admin-users-edit', {'user':rows[0], 'activationStatus':config.userActivationStatus, 'error':req.query.error?req.query.error:null});
         }
     });
});

app.post('/admin/users/edit/:userid', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `fname`=?, `lname`=?, `nick`=?, `email`=?, `activated`=? WHERE `idusers`=?", [req.body.fname, req.body.lname, req.body.nick, req.body.email, req.body.activated, req.params.userid], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/users/edit/' + req.params.idcontent + '?error=' + err.code);
        } else {
            res.redirect('/admin/users');
        }
    });
});

app.get('/admin/sessions', isActivatedUser, isAdminUser, function (req, res) {
    var low = 0, high = 1000;
    if (req.query.low) {
        low = parseInt(req.query.low);
    }
    if (req.query.high) {
        high = parseInt(req.query.high);
    }
    sqlConnection.query('SELECT * FROM `sessions` LIMIT ?, ?', [low, high], function (err, rows, fields) {
        if (err) throw err;
        res.render('admin-sessions', {rows: rows, low: low, high: high});
    }); 
});

app.get('/admin/sessions/delete', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`sessions` WHERE `session_id`=?", [req.query.sessionid], function (err, result) {
        res.redirect(req.headers.referer);
    });
});

app.get('/admin/api', isActivatedUser, isAdminUser, function (req, res) {
    var low = 0, high = 1000;
    if (req.query.low) {
        low = parseInt(req.query.low);
    }
    if (req.query.high) {
        high = parseInt(req.query.high);
    }
    sqlConnection.query('SELECT * FROM `apiauth` LIMIT ?, ?', [low, high], function (err, rows, fields) {
        if (err) throw err;
        res.render('admin-api', {rows: rows, low: low, high: high});
    });
});

app.post('/admin/api/password', isActivatedUser, isAdminUser, function (req, res) {
    if (req.body.newpassword !== req.body.confirmpassword) {
        res.status(403).send('Passwords do not match');
    } else {
        sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`apiauth` SET `password`=? WHERE `idapiauth`=?", [md5(req.body.newpassword), req.query.idapiauth], function (err, result) {
            if (err !== null) {
                res.status(500).send('Failed to update');
            } else {
                res.redirect(req.headers.referer);
            }
        });
    }
});

app.post('/admin/api/urls', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`apiauth` SET `urls`=? WHERE `idapiauth`=?", [req.body.longtext, req.query.idapiauth], function (err, result) {
        if (err !== null) {
            res.status(500).send('Failed to update');
        } else {
            res.redirect(req.headers.referer);
        }
    });
});

app.get('/admin/api/delete', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`apiauth` WHERE `idapiauth`=?", [req.query.idapiauth], function (err, result) {
        res.redirect(req.headers.referer);
    });
});

app.get('/admin/api/create', isActivatedUser, isAdminUser, function (req, res) {
    res.render('admin-api-create', {'error': req.query.error});
});

app.post('/admin/api/create', isActivatedUser, isAdminUser, function (req, res) {
    if (req.body.password !== req.body.confirmpassword) {
        res.redirect('/admin/api/create?error=PASS_MISMATCH');
    } else {
        sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`apiauth` (`username`, `password`, `urls`) VALUES (?, ?, ?)", [req.body.username, md5(req.body.password), req.body.urls], function (err, result) {
            if (err !== null) {
                res.redirect('/admin/api/create?error=' + err.code);
            } else {
                res.redirect('/admin/api');
            }
        });
    }
});

app.get('/admin/content', isActivatedUser, isAdminUser, function (req, res) {
    var low = 0, high = 1000;
    if (req.query.low) {
        low = parseInt(req.query.low);
    }
    if (req.query.high) {
        high = parseInt(req.query.high);
    }
    sqlConnection.query('SELECT * FROM `content` LIMIT ?, ?', [low, high], function (err, rows, fields) {
        if (err) throw err;
        res.render('admin-content', {rows: rows, low: low, high: high});
    });
});

app.get('/admin/content/create', isActivatedUser, isAdminUser, function (req, res) {
    res.render('admin-content-create', {'content':{'shortname':'','description':'','login':'','logout':''}});
});

app.post('/admin/content/create', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`content` (`shortname`, `description`, `logout`, `login`) VALUES (?, ?, ?, ?)", [req.body.shortname, req.body.description, req.body.logout, req.body.login], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/content/create?error=' + err.code);
        } else {
            res.redirect('/admin/content');
        }
    });
});

app.get('/admin/content/edit/:idcontent', isActivatedUser, isAdminUser, function (req, res) {
     sqlConnection.query('SELECT * FROM `content` WHERE `idcontent`=?', [req.params.idcontent], function (err, rows, fields) {
         if (rows.length > 0) {
             res.render('admin-content-create', {'content':rows[0]});
         }
     });
});

app.post('/admin/content/edit/:idcontent', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`content` SET `shortname`=?, `description`=?, `logout`=?, `login`=? WHERE `idcontent`=?", [req.body.shortname, req.body.description, req.body.logout, req.body.login, req.params.idcontent], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/content/edit/' + req.params.idcontent + '?error=' + err.code);
        } else {
            res.redirect('/admin/content');
        }
    });
});

app.get('/admin/content/delete', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`content` WHERE `idcontent`=?", [req.query.idcontent], function (err, result) {
        res.redirect(req.headers.referer);
    });
});

var reportReasons = ['It\'s spam', 'It\'s inappropriate', 'It\'s offensive', 'It\'s about me/someone else', 'It\'s something not mentioned here'];
var reportStatuses = ['New', 'Investigating', 'Awaiting Info', 'Awaiting decision', 'Closed (Forwarded)', 'Closed (Removed)', 'Closed (Edited)', 'Closed (Rejected)'];

app.get('/admin/report', isActivatedUser, isAdminUser, function (req, res) {
    var low = 0, high = 1000;
    if (req.query.low) {
        low = parseInt(req.query.low);
    }
    if (req.query.high) {
        high = parseInt(req.query.high);
    }
    sqlConnection.query('SELECT * FROM `report` ORDER BY `status` LIMIT ?, ?', [low, high], function (err, rows, fields) {
        if (err) throw err;
        res.render('admin-report', {rows: rows, low: low, high: high, statuses: reportStatuses, reasons: reportReasons});
    });
});

app.get('/admin/report/create', isActivatedUser, isAdminUser, function (req, res) {
    res.render('admin-report-create', {reasons: reportReasons, error:req.query.error?req.query.error:null});
});

app.post('/admin/report/create', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`report` (`type`, `source`, `item`, `highlevel`, `details`, `userid`) VALUES (?, ?, ?, ?, ?, ?)", [req.body.type.replace(/(<([^>]+)>)/ig,""), req.body.source.replace(/(<([^>]+)>)/ig,""), req.body.item.replace(/(<([^>]+)>)/ig,""), parseInt(req.body.highlevel), (req.body.details==null)?null:req.body.details.replace(/(<([^>]+)>)/ig,""), (req.body.userid=='')?null:parseInt(req.body.userid)], function (err, result) {
        console.log(err);
        if (err === null) {
            // Success
            res.redirect('/admin/report/item/' + result.insertId);
        } else {
            // Error
            res.redirect('/admin/report/create?error=' + err.code);
        }
    });
});

app.get('/admin/report/item/:reportid', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query('SELECT * FROM `report` WHERE `idreport`=?', [req.params.reportid], function (err, rows, fields) {
         if (rows.length > 0) {
             res.render('admin-report-item', {'report':rows[0], "statuses": reportStatuses, "reasons": reportReasons, "error":req.query.error?req.query.error:null});
         }
     });
});

app.post('/admin/report/item/:reportid', isActivatedUser, isAdminUser, function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`report` SET `notes`=?, `status`=? WHERE `idreport`=?", [req.body.notes, req.body.status, req.params.reportid], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/report/item/' + req.params.reportid + '?error=' + err.code);
        } else {
            res.redirect('/admin/report/item/' + req.params.reportid + '?error=S_OK');
        }
    });
});

// API calls for websites
var apiAuth = function (req, res, next) {
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
                    return apiAuthUnauth(res);
                }
            } else {
                return apiAuthUnauth(res);
            }
        } else {
            return apiAuthUnauth(res);
        }
    });
}

var apiAuthUnauth = function (res, realm) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic realm="Authorization required"');
  res.end('Unauthorized');
};

app.get('/api/user', apiAuth, isActivatedUser, function (req, res) {
    res.type('application/json');
    res.send({'id':req.user.id, 'email':req.user.emails[0].value, 'displayName':req.user.displayName});
});

app.get('/api/user/:uid', apiAuth, function (req, res) {
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
});

app.get('/api/name', apiAuth, isActivatedUser, function (req, res) {
    res.type('application/json');
    res.send({'id':req.user.id, 'name':req.user.name, 'displayName':req.user.displayName});
});

app.get('/api/session/:sessionid', apiAuth, function (req, res) {
    console.log(req.params.sessionid);
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
});

// Content pages
var contentAuth = function (req, res, next) {
    var authorization = req.headers.authorization;
    if (!authorization) return contentAuthUnauth(res);
    
    var parts = authorization.split(' ');
    if (parts.length !== 2) return next(error(400));
    var scheme = parts[0],
        credentials = new Buffer(parts[1], 'base64').toString();
    if ('Public' != scheme) return next(error(400));
    var user = credentials;
    
    sqlConnection.query('SELECT * FROM `apiauth` WHERE `username`=?', [user], function (err, rows, fields) {
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
                return contentAuthUnauth(res);
            }
        } else {
            return contentAuthUnauth(res);
        }
    });
};

var contentAuthUnauth = function (res, realm) {
  res.statusCode = 401;
  res.end('Unauthorized');
};

app.options('/content/:shortname', function (req, res) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Authorization, Cookie');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.send();
});

app.get('/content/:shortname', contentAuth, function (req, res) {
    sqlConnection.query('SELECT * FROM `content` WHERE `shortname`=?', [req.params.shortname], function (err, rows, fields) {
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
});

// Auth (Allow sites to start authentication flow)
var authAuth = function(req, res, next) {
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

app.get('/auth/:scheme/:sitename/:port/msg', authAuth, isActivatedUser, function (req, res) {
    res.render('auth-msg', {'sitename':req.params.sitename,'scheme':req.params.scheme,'port':req.params.port});
    delete req.session.auth;
    delete req.session.referer;
});

// Reporting system
app.get('/report/new', function (req, res) {
    if (!req.query.type || !req.query.source || !req.query.item) {
        res.statusCode = 400;
        res.end("Report query was malformed");
    } else {
        res.render('report-new', {"type":req.query.type, "source":req.query.source, "item":req.query.item, "userid":req.user?req.user.id:null, "email":req.user?req.user.emails[0].value:null,"reasons":reportReasons});
    }
});

var submitReport = function (req, res) {
    if (req.session.report.userid == '') {
        req.session.report.userid = req.user.id;
    }
    if (req.session.report.details == '') {
        req.session.report.details = null;
    }
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`report` (`type`, `source`, `item`, `highlevel`, `details`, `userid`) VALUES (?, ?, ?, ?, ?, ?)", [req.session.report.type.replace(/(<([^>]+)>)/ig,""), req.session.report.source.replace(/(<([^>]+)>)/ig,""), req.session.report.item.replace(/(<([^>]+)>)/ig,""), parseInt(req.session.report.highlevel), (req.session.report.details==null)?null:req.session.report.details.replace(/(<([^>]+)>)/ig,""), (req.session.report.userid==null)?null:parseInt(req.session.report.userid)], function (err, result) {
        console.log(err);
        if (err === null) {
            // Success
            // Send a message to alert the team about the report
            var email = new sendgrid.Email({
                "to": config.reportEmail,
                "from": req.user.emails[0].value,
                "subject": "Content Report",
                "text": "A new content report for " + req.session.report.type.replace(/(<([^>]+)>)/ig,"") + req.session.report.item.replace(/(<([^>]+)>)/ig,"") + " at " + req.session.report.source.replace(/(<([^>]+)>)/ig,"") + ".  The user reported this as '" + reportReasons[parseInt(req.session.report.highlevel)] + "'\r\n\r\nThis report can be viewed at " + config.root + "/admin/report/item/" + result.insertId + ".\r\n\r\nRegards\r\n\r\nNouse Account Team"
            });
            sendgrid.send(email, function (err, json) {
                if (err) console.log(err);
                console.log(json);
            })
            // Display confirmation to the user
            res.render('report-sent');
            delete req.session.report;
        } else {
            // Error
            res.redirect(307, '/report/submit/email?error=1');
        }
    });
};

app.post('/report/submit', function (req, res, next) {
    // Store the object in the session, in case we're being asked to log the user in
    if (!req.body.highlevel && !req.session.report) {
        res.statusCode = 400;
        res.end("Report query was malforemd");
    } else {
        if (req.body.highlevel) {
            req.session.report = req.body;
        }
        return next();
    }
}, isActivatedUser, submitReport);

app.get('/report/submit', isActivatedUser, submitReport);

app.post('/report/submit/email', function (req, res) {
    var error = false;
    if (req.query.error) {
        error = true;
    }
    if (!req.body.highlevel && !req.session.report) {
        res.statusCode = 400;
        res.end("Report query was malforemd");
    } else {
        var report;
        if (req.body.highlevel) {
            report = req.body;
        } else {
            report = req.session.report;
            delete req.session.report;
        }
        var msg = "type: " + report.type.replace(/(<([^>]+)>)/ig,"") + ",\r\n";
        msg += "source: " + report.source.replace(/(<([^>]+)>)/ig,"") + ",\r\n";
        msg += "item: " + report.item.replace(/(<([^>]+)>)/ig,"") + ",\r\n";
        msg += "highlevel: " + report.highlevel.replace(/(<([^>]+)>)/ig,"") + ",\r\n";
        msg += "details: " + report.details.replace(/(<([^>]+)>)/ig,"");
        res.render('report-email', {"email": config.reportEmail, "error":error, "msg":msg});
    }
});

// Run server
var server = http.createServer(app);
server.listen(app.get('port'));
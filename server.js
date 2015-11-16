'use strict';

// Import Modules

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
    fs = require('fs');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

var config = require('./config');

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

// Create a new Profile for the user
function createProfileFromGoogle(googleprofile) {
    return sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`users` (`fname`, `lname`, `email`, `activated`, `lastLogin`) VALUES ('" + googleprofile.name.givenName + "', '" + googleprofile.name.familyName + "', '" + googleprofile.emails[0].value + "', '2', NOW())", function (err, result) {
        if (err !== null) return false;
        return sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`googleauth` (`googid`, `idusers`) VALUES (?, ?)", [googleprofile.id, result.insertId], function (err2, result2) {
            if (err2 !== null) return false;
            return true;
        });
    });
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
    sqlConnection.query('SELECT * FROM `googleauth` WHERE `googid`=?', [profile.id], function (err, rows, fields) {
        if (rows.length > 0) {
            sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [rows[0].idusers], function (err, rows, fields) {
                sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `lastLogin`=NOW() WHERE `idusers`='" + rows[0].idusers + "'", function (err, result) {
                    return done(null, generateProfile(rows[0]));
                });
            });
        }
        // Account doesn't exist
        // Create a new one
        if (createProfileFromGoogle(profile)) {
            return sqlConnection.query('SELECT * FROM `googleauth` WHERE `googid`=?', [profile.id], function (err, rows, fields) {
                console.log(profile.id);
                console.log(err);
                console.log(rows);
                return sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [rows[0].idusers], function (err, rows, fields) {
                    return done(null, generateProfile(rows[0]));
                }); 
            });
        } else {
            return done(null, false);
        }
    });
}));

app.get('/login/google', passport.authenticate('google' , {
    scope: ['profile', 'email']
}));

app.get('/login/google/callback', passport.authenticate('google', {
    successRedirect: '/continue',
    failureRedirect: '/'
}));

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
    res.render('account', {user: req.user, email: emailAddr});
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
    sqlConnection.query('SELECT * FROM `users` LIMIT ?, ?', [low, high], function (err, rows, fields) {
        if (err) throw err;
        res.render('admin-users', {rows: rows, low: low, high: high});
    })
});


// Run server
var server = http.createServer(app);
server.listen(app.get('port'));
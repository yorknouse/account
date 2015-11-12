'use strict';

// Import Modules

var express = require('express'),
    path = require('path'),
    http = require('http'),
    session = require('express-session'),
    cookie = require('cookie-parser'),
    body = require('body-parser'),
    passport = require('passport'),
    mysql = require('mysql');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

var config = require('./config');

var app = express();

app.set('port', process.env.PORT || 22360);
app.set('views', path.join(__dirname, 'template'));
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));

app.use(cookie());
app.use(body.urlencoded({'extended': true}));


// Set-up session storage
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
    proxy: null
}));

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

// Manage Database accounts
function findUserGoogle(googleid) {
    sqlConnection.query('SELECT * FROM `users` WHERE `googid`=?', [googleid], function (err, result, fields) {
        // If user exists return their information as JSON
        // If they don't then raise an error
    });
}

function findUserEmail(email) {
    sqlConnection.query('SELECT * FROM `users` WHERE `email`=?', [email], function (err, result, fields) {
        // If user exists return their information as JSON
        // If they don't then raise an error
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
    res.redirect('/login');
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
    //For now allow only @nouse.co.uk addresses
    var i;
    for (i = 0; i < profile.emails.length; i += 1) {
        if (profile.emails[i].value.substr(-12) === '@nouse.co.uk') {
            return done(null, profile);
        }
    }
    return done(null, false);
}));

app.get('/login/google', passport.authenticate('google' , {
    scope: ['profile', 'email']
}));

app.get('/login/google/callback', passport.authenticate('google', {
    successRedirect: '/account',
    failureRedirect: '/'
}))

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
app.get('/account', isLoggedIn, function (req, res) {
    var i, emailAddr;
    for (i = 0; i < req.user.emails.length; i += 1) {
        emailAddr = req.user.emails[i].value;
    }
    res.render('account', {user: req.user, email: emailAddr});
});


// Run server
var server = http.createServer(app);
server.listen(app.get('port'));
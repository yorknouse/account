'use strict';

// Import Modules
var config = require('./config'),
    db = require('./db'),
    login = require('./login'),
    signup = require('./signup'),
    connect = require('./connect'),
    admin = require('./admin'),
    common = require('./common'),
    api = require('./api'),
    content = require('./content'),
    auth = require('./auth'),
    report = require('./report'),
    setup = require('./setup');

var express = require('express'),
    path = require('path'),
    http = require('http'),
    session = require('express-session'),
    cookie = require('cookie-parser'),
    body = require('body-parser'),
    passport = require('passport'),
    bodyparser = require('body-parser'),
    mysqlSessionStore = require('express-mysql-session'),
    jade = require('jade');

if (!setup.setup()) {
    console.log("Setup failed");
    process.exit(1);
}

var app = express();

app.set('port', process.env.PORT || 22360);
app.set('views', path.join(__dirname, 'template'));
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));

app.use(cookie());
app.use(bodyparser.urlencoded({'extended': true}));


// Set-up database access
var sqlConnection = db.sqlConnection();

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

app.get('/login', login.login)

// Login code for Google
passport.use(login.googleStrategy);

app.get('/login/google', passport.authenticate('google' , {
    scope: ['profile', 'email']
}));

app.get('/login/google/callback', passport.authenticate('google', {
    successRedirect: '/login/google/continue',
    failureRedirect: '/'
}));

app.get('/login/google/continue', login.googleContinue);
app.get('/login/google/link', login.googleLink);

// Login code for Facebook
passport.use(login.facebookStrategy);

app.get('/login/facebook', passport.authenticate('facebook', {
    scope: ['public_profile', 'email']
}));

app.get('/login/facebook/retry', passport.authenticate('facebook', {
    scope: ['public_profile', 'email'],
    authType: 'rerequest'
}));

app.get('/login/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/login/facebook/continue',
    failureRedirect: '/'
}));

app.get('/login/facebook/continue', login.facebookContinue);
app.get('/login/facebook/link', login.facebookLink);
app.get('/login/facebook/error', login.facebookError);

// Login code for Wordpress
passport.use(login.wordpressStrategy);

app.get('/login/wordpress', passport.authenticate('wordpress'));

app.get('/login/wordpress/callback', passport.authenticate('wordpress', {
    successRedirect: '/login/wordpress/continue',
    failureRedirect: '/'
}));

app.get('/login/wordpress/continue', login.wordpressContinue);
app.get('/login/wordpress/link', login.wordpressLink);

// Login code for Local
passport.use(login.localStrategy);

app.get('/login/local', login.localGet);
app.post('/login/local', passport.authenticate('local', {failureRedirect: '/login/local?error=1'}), login.localPost);
app.get('/register', login.registerGet);
app.post('/register', login.registerPost, login.registerLink, login.registerLogin);
app.get('/register/activate', login.registerActivateGet);
app.post('/register/activate', login.registerActivatePost, login.registerActivateConfirm);

app.get('/login/continue', login.continue);

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
app.get('/signup/abandon', signup.abandon);
app.get('/signup/terms', isLoggedIn, signup.terms);
app.get('/signup/terms/accept', isLoggedIn, signup.termsAccept);
app.get('/signup/terms/reject', isLoggedIn, signup.termsReject);
app.get('/signup/validate', signup.validate);
app.get('/signup/activate', signup.activate, signup.activateConfirm);

// Logout code
app.get('/logout', login.logout);

// Connect accounts code
app.get('/connect', connect.connect);
app.get('/connect/continue', connect.continue);

passport.use('google-connect', connect.googleStrategy);

app.get('/connect/google', passport.authorize('google-connect' , {
    scope: ['profile', 'email']
}));

app.get('/connect/google/callback', passport.authorize('google-connect', {
    failureRedirect: '/connect?error=1'
}), connect.googleCallback);

passport.use('facebook-connect', connect.facebookStrategy);

app.get('/connect/facebook', passport.authorize('facebook-connect' , {
    scope: ['public_profile', 'email']
}));

app.get('/connect/facebook/callback', passport.authorize('facebook-connect', {
    failureRedirect: '/connect?error=1'
}), connect.facebookCallback);

app.get('/connect/facebook/retry', passport.authorize('facebook-connect', {
    scope: ['public_profile', 'email'],
    authType: 'rerequest'
}), connect.facebookCallback);

app.get('/connect/facebook/error', connect.facebookError);

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
    sqlConnection.query("UPDATE `users` SET `nick`=? WHERE `idusers`=?", [req.body.nickname, req.user.id], function (err, result) {
        // Update the User object before redirecting
        var updatedUser = req.user;
        updatedUser.displayName = sqlConnection.escape(req.body.nickname).split("'")[1];
        req.login(updatedUser, function (err) {
            res.redirect('/continue');
        });
    });
});

// Admin Pages
app.get('/admin', isActivatedUser, isAdminUser, admin.admin);
app.get('/admin/users', isActivatedUser, isAdminUser, admin.users);
app.get('/admin/users/suspend', isActivatedUser, isAdminUser, admin.usersSuspend);
app.get('/admin/users/unsuspend', isActivatedUser, isAdminUser, admin.usersUnsuspend);
app.get('/admin/users/delete', isActivatedUser, isAdminUser, admin.usersDelete);
app.get('/admin/users/delete/google', isActivatedUser, isAdminUser, admin.usersDeleteGoogle);
app.get('/admin/users/delete/facebook', isActivatedUser, isAdminUser, admin.usersDeleteFacebook);
app.get('/admin/users/delete/wordpress', isActivatedUser, isAdminUser, admin.usersDeleteWordpress);
app.get('/admin/users/delete/local', isActivatedUser, isAdminUser, admin.usersDeleteLocal);
app.get('/admin/users/edit/:userid', isActivatedUser, isAdminUser, admin.usersEditGet);
app.post('/admin/users/edit/:userid', isActivatedUser, isAdminUser, admin.usersEditPost);
app.get('/admin/sessions', isActivatedUser, isAdminUser, admin.sessions);
app.get('/admin/sessions/delete', isActivatedUser, isAdminUser, admin.sessionsDelete);
app.get('/admin/api', isActivatedUser, isAdminUser, admin.api);
app.post('/admin/api/password', isActivatedUser, isAdminUser, admin.apiPassword);
app.post('/admin/api/urls', isActivatedUser, isAdminUser, admin.apiUrls);
app.get('/admin/api/delete', isActivatedUser, isAdminUser, admin.apiDelete);
app.get('/admin/api/create', isActivatedUser, isAdminUser, admin.apiCreateGet);
app.post('/admin/api/create', isActivatedUser, isAdminUser, admin.apiCreatePost);
app.get('/admin/content', isActivatedUser, isAdminUser, admin.content);
app.get('/admin/content/create', isActivatedUser, isAdminUser, admin.contentCreateGet);
app.post('/admin/content/create', isActivatedUser, isAdminUser, admin.contentCreatePost);
app.get('/admin/content/edit/:idcontent', isActivatedUser, isAdminUser, admin.contentEditGet);
app.post('/admin/content/edit/:idcontent', isActivatedUser, isAdminUser, admin.contentEditPost);
app.get('/admin/content/delete', isActivatedUser, isAdminUser, admin.contentDelete);
app.get('/admin/report', isActivatedUser, isAdminUser, admin.report);
app.get('/admin/report/create', isActivatedUser, isAdminUser, admin.reportCreateGet);
app.post('/admin/report/create', isActivatedUser, isAdminUser, admin.reportCreatePost);
app.get('/admin/report/item/:reportid', isActivatedUser, isAdminUser, admin.reportItemGet);
app.post('/admin/report/item/:reportid', isActivatedUser, isAdminUser, admin.reportItemPost);

// API calls for websites
app.get('/api/user', api.auth, isActivatedUser, api.currentUser);
app.get('/api/user/:uid', api.auth, api.user);
app.get('/api/user/:uid/emails', api.auth, api.userEmails)
app.get('/api/user/:uid/emails/:domain', api.auth, api.userEmails)
app.get('/api/name', api.auth, isActivatedUser, api.name);
app.get('/api/session/:sessionid', api.auth, api.session);

// Content pages
app.options('/content/:shortname', content.shortnameOptions);
app.get('/content/:shortname', content.auth, content.shortnameGet);

// Auth (Allow sites to start authentication flow)
app.get('/auth/:scheme/:sitename/:port/msg', auth.auth, isActivatedUser, auth.msg);
app.get('/auth/:scheme/:sitename/:port/rdr', auth.auth, isActivatedUser, auth.rdr);

// Reporting system
app.get('/report/new', report.new);
app.post('/report/submit', report.submitPost, isActivatedUser, report.submit);
app.get('/report/submit', isActivatedUser, report.submit);
app.post('/report/submit/email', report.email);

// Run server
var server = http.createServer(app);
console.log('Server ready - starting to listen');
server.listen(app.get('port'));
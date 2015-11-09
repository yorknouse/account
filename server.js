'use strict';

// Import Modules

var express = require('express'),
    path = require('path'),
    http = require('http');

var app = express();

app.set('port', process.env.PORT || 22360);
app.set('views', path.join(__dirname, 'template'));
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.render('index');
});

var server = http.createServer(app);
server.listen(app.get('port'));
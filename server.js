'use strict';

// Import Modules

var express = require('express'),
    path = require('path'),
    http = require('http');;

var app = express();

app.set('port', process.env.PORT || 22360);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.send('<!DOCTYPE html><html><head><title>Nouse</title></head><body><h1>Coming soon</h1></body></html>');
});

var server = http.createServer(app);
server.listen(app.get('port'));
'use strict';

var config = require('./config');

var mysql = require('mysql');

exports.sqlConnection = function () {
    var conn = mysql.createConnection({
        host: config.mysqlHost,
        user: config.mysqlUser,
        password: config.mysqlPass,
        database: config.mysqlDatabase,
        port: config.mysqlPort
    });
    conn.connect(function (err) {
        if (err) {
            console.log(err.stack);
            return;
        }

        console.log("Connected to database");
    });
    return conn;
};
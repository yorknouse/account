'use strict';

var config = require('./config'),
    db = require('./db');

var fs = require('fs');

function verifyConfig() {
    // Go through and ensure all config settings are set correctly
    // Static values
    if (!config.root || config.root == '') {
        console.log('No root address given');
        return false;
    }
    if (!config.secret || config.secret == '') {
        console.log('No secret key given');
        return false;
    }
    if (!config.name || config.name == '') {
        console.log('No name given');
        return false;
    }
    
    // API keys
    if (!config.googleClientId || !config.googleClientSecret || config.googleClientId == '' || config.googleClientSecret == '') {
        console.log('Google API key incorrect');
        return false;
    }
    if (!config.facebookClientId || !config.facebookClientSecret || config.facebookClientId == '' || config.facebookClientSecret == '') {
        console.log('Facebook API key incorrect');
        return false;
    }
    if (!config.sendgridAPIkey || !config.sendgridAPIuser || config.sendgridAPIkey == '' || config.sendgridAPIuser == '') {
        console.log('Sendgrid API key incorrect');
        return false;
    }
    
    // Email addresses
    if (!config.reportEmail || config.reportEmail == '') {
        console.log('Report email missing');
        return false;
    } else if (config.reportEmail.indexOf('@') == -1 || config.reportEmail.split('@')[1].indexOf('.') == -1) {
        console.log('Report email format incorrect');
        return false;
    }
    if (!config.supportEmail || config.supportEmail == '') {
        console.log('Support email missing');
        return false;
    } else if (config.supportEmail.indexOf('@') == -1 || config.supportEmail.split('@')[1].indexOf('.') == -1) {
        console.log('Support email format incorrect');
        return false;
    }
    
    // Lists
    if (!config.userActivationStatus) {
        console.log('User Activation Status not set');
        return false;
    } else if (config.userActivationStatus.length !== 10) {
        console.log('User activation statuses missing, should be 10');
        return false;
    } else {
        for (var status in config.userActivationStatus) {
            if (status == '') {
                console.log('Status name not given correctly');
                return false;
            }
        }
    }
    
    // Database connection
    if (!config.mysqlHost || config.mysqlHost == '') {
        console.log('No mysqlHost given');
        return false;
    }
    if (!config.mysqlDatabase || config.mysqlDatabase == '') {
        console.log('No mysqlDatabase given');
        return false;
    }
    if (!config.mysqlPass || config.mysqlPass == '') {
        console.log('No mysqlPass given');
        return false;
    }
    if (!config.mysqlUser || config.mysqlUser == '') {
        console.log('No mysqlUser given');
        return false;
    }
    if (!config.mysqlPort) {
        console.log('No mysqlPort given');
        return false;
    } else if (config.mysqlPort < 0 || config.mysqlPort > 65535) {
        console.log('mysqlPort out of range');
        return false;
    }
    
    var mysql = require('mysql');
    var conn = mysql.createConnection({
        host: config.mysqlHost,
        user: config.mysqlUser,
        password: config.mysqlPass,
        database: config.mysqlDatabase,
        port: config.mysqlPort
    });
    conn.connect(function (err) {
        if (err) {
            console.log('Unable to connect to database');
            console.log(err);
            return false;
        }
    });
    conn.end();
    
    // Files
    if (!config.termsFile || config.termsFile == '') {
        console.log('Terms file not set');
        return false;
    }
    /*fs.access(config.termsFile, fs.F_OK, function (err) {
        if (err) {
            console.log('Unable to find terms file');
            return false;
        }
    });
    fs.access(config.termsFile, fs.R_OK, function (err) {
        if (err) {
            console.log('Unable to read terms file');
            return false;
        }
    });*/
    fs.readFile(config.termsFile, 'utf8', function (err, content) {
        if (err) {
            console.log('Error reading terms file');
            console.log(err);
            return false;
        }
        if (!content || content.trim() == '') {
            console.log('Terms file is empty');
            return false;
        }
    });
    
    return true;
}

function createDatabase() {
    // Create the database based on a series of tests
    /*fs.access('dbsetup.sql', fs.R_OK, function (err) {
        if (err) {
            console.log('Unable to read database setup script');
            return false;
        }*/
        fs.readFile('dbsetup.sql', 'utf8', function (err, content) {
            if (err) {
                console.log('Error reading database setup script');
                return false;
            }
            
            content = content.replace('nouseaccount', config.mysqlDatabase); // Set correct database name in script
            
            var mysql = require('mysql');
            var conn = mysql.createConnection({
                host: config.mysqlHost,
                user: config.mysqlUser,
                password: config.mysqlPass,
                database: config.mysqlDatabase,
                port: config.mysqlPort,
                multipleStatements: true
            });
            conn.connect(function (err) {
                if (err) {
                    console.log('Unable to connect to database');
                    console.log(err);
                    return false;
                }
            });
            conn.query(content, function (err, results) {
                // Results of database creation
                if (err) {
                    console.log(err);
                    return false;
                }
            });
            conn.end();
        });
    //});
    return true;
}

function updateDatabase() {
    // Make any changes to the database from the default configuration
    // Currently there are no updates so there is no need to use it
    return true;
}

exports.setup = function () {
    console.log('Setting up account');
    
    if (!verifyConfig()) return false;
    if (!createDatabase()) return false;
    if (!updateDatabase()) return false;
    
    console.log('account setup successful!');
    return true;
}
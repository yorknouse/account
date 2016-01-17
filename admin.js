'use strict';

var config = require('./config'),
    db = require('./db'),
    common = require('./common');

var md5 = require('js-md5');

var sqlConnection = db.sqlConnection();

// Main admin page
exports.admin = function (req, res) {
    res.render('admin-index');
};

// Users admin
exports.users = function (req, res) {
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
};

exports.usersSuspend = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `activated`=0 WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        res.redirect(req.headers.referer);
    });
};

exports.usersUnsuspend = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `activated`=2 WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        res.redirect(req.headers.referer);
    });
};

exports.usersDelete = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `fname`='', `lname`='', `email`='', `activated`=0 WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        req.session.dest = req.headers.referer;
        res.redirect('/admin/users/delete/google?idusers=' + req.query.idusers);
    });
};

exports.usersDeleteGoogle = function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`googleauth` WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        res.redirect('/admin/users/delete/local?idusers=' + req.query.idusers);
    });
};

exports.usersDeleteLocal = function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`localauth` WHERE `idusers`=?", [req.query.idusers], function (err, result) {
        res.redirect('/continue');
    });
};

exports.usersEditGet = function (req, res) {
    sqlConnection.query('SELECT * FROM `users` WHERE `idusers`=?', [req.params.userid], function (err, rows, fields) {
         if (rows.length > 0) {
             res.render('admin-users-edit', {'user':rows[0], 'activationStatus':config.userActivationStatus, 'error':req.query.error?req.query.error:null});
         }
     });
};

exports.usersEditPost = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`users` SET `fname`=?, `lname`=?, `nick`=?, `email`=?, `activated`=? WHERE `idusers`=?", [req.body.fname, req.body.lname, req.body.nick, req.body.email, req.body.activated, req.params.userid], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/users/edit/' + req.params.idcontent + '?error=' + err.code);
        } else {
            res.redirect('/admin/users');
        }
    });
};

// Sessions
exports.sessions = function (req, res) {
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
};

exports.sessionsDelete = function (req, res) {
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
};

// API
exports.api = function (req, res) {
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
};

exports.apiPassword =  function (req, res) {
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
};

exports.apiUrls = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`apiauth` SET `urls`=? WHERE `idapiauth`=?", [req.body.longtext, req.query.idapiauth], function (err, result) {
        if (err !== null) {
            res.status(500).send('Failed to update');
        } else {
            res.redirect(req.headers.referer);
        }
    });
};

exports.apiDelete = function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`apiauth` WHERE `idapiauth`=?", [req.query.idapiauth], function (err, result) {
        res.redirect(req.headers.referer);
    });
};

exports.apiCreateGet = function (req, res) {
    res.render('admin-api-create', {'error': req.query.error});
};

exports.apiCreatePost = function (req, res) {
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
};

// Content
exports.content = function (req, res) {
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
};

exports.contentCreateGet = function (req, res) {
    res.render('admin-content-create', {'content':{'shortname':'','description':'','login':'','logout':''}});
};

exports.contentCreatePost =  function (req, res) {
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`content` (`shortname`, `description`, `logout`, `login`) VALUES (?, ?, ?, ?)", [req.body.shortname, req.body.description, req.body.logout, req.body.login], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/content/create?error=' + err.code);
        } else {
            res.redirect('/admin/content');
        }
    });
};

exports.contentEditGet = function (req, res) {
     sqlConnection.query('SELECT * FROM `content` WHERE `idcontent`=?', [req.params.idcontent], function (err, rows, fields) {
         if (rows.length > 0) {
             res.render('admin-content-create', {'content':rows[0]});
         }
     });
};

exports.contentEditPost = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`content` SET `shortname`=?, `description`=?, `logout`=?, `login`=? WHERE `idcontent`=?", [req.body.shortname, req.body.description, req.body.logout, req.body.login, req.params.idcontent], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/content/edit/' + req.params.idcontent + '?error=' + err.code);
        } else {
            res.redirect('/admin/content');
        }
    });
};

exports.contentDelete = function (req, res) {
    sqlConnection.query("DELETE FROM `" + config.mysqlDatabase + "`.`content` WHERE `idcontent`=?", [req.query.idcontent], function (err, result) {
        res.redirect(req.headers.referer);
    });
};

// Report
exports.report = function (req, res) {
    var low = 0, high = 1000;
    if (req.query.low) {
        low = parseInt(req.query.low);
    }
    if (req.query.high) {
        high = parseInt(req.query.high);
    }
    sqlConnection.query('SELECT * FROM `report` ORDER BY `status` LIMIT ?, ?', [low, high], function (err, rows, fields) {
        if (err) throw err;
        res.render('admin-report', {rows: rows, low: low, high: high, statuses: common.reportStatuses, reasons: common.reportReasons});
    });
};

exports.reportCreateGet = function (req, res) {
    res.render('admin-report-create', {reasons: common.reportReasons, error:req.query.error?req.query.error:null});
};

exports.reportCreatePost = function (req, res) {
    sqlConnection.query("INSERT INTO `" + config.mysqlDatabase + "`.`report` (`type`, `source`, `item`, `highlevel`, `details`, `userid`) VALUES (?, ?, ?, ?, ?, ?)", [req.body.type.replace(/(<([^>]+)>)/ig,""), req.body.source.replace(/(<([^>]+)>)/ig,""), req.body.item.replace(/(<([^>]+)>)/ig,""), parseInt(req.body.highlevel), (req.body.details==null)?null:req.body.details.replace(/(<([^>]+)>)/ig,""), (req.body.userid=='')?null:parseInt(req.body.userid)], function (err, result) {
        if (err === null) {
            // Success
            res.redirect('/admin/report/item/' + result.insertId);
        } else {
            // Error
            res.redirect('/admin/report/create?error=' + err.code);
        }
    });
};

exports.reportItemGet = function (req, res) {
    sqlConnection.query('SELECT * FROM `report` WHERE `idreport`=?', [req.params.reportid], function (err, rows, fields) {
         if (rows.length > 0) {
             res.render('admin-report-item', {'report':rows[0], "statuses": common.reportStatuses, "reasons": common.reportReasons, "error":req.query.error?req.query.error:null});
         }
     });
};

exports.reportItemPost = function (req, res) {
    sqlConnection.query("UPDATE `" + config.mysqlDatabase + "`.`report` SET `notes`=?, `status`=? WHERE `idreport`=?", [req.body.notes, req.body.status, req.params.reportid], function (err, result) {
        if (err !== null) {
            res.redirect('/admin/report/item/' + req.params.reportid + '?error=' + err.code);
        } else {
            res.redirect('/admin/report/item/' + req.params.reportid + '?error=S_OK');
        }
    });
};
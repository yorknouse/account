'use strict';

var config = require('./config'),
    db = require('./db'),
    common = require('./common'),
    sendgrid = require('sendgrid')(config.sendgridAPIkey);

var sqlConnection = db.sqlConnection();

// Report functions

exports.new = function (req, res) {
    if (!req.query.type || !req.query.source || !req.query.item) {
        res.statusCode = 400;
        res.end("Report query was malformed");
    } else {
        res.render('report-new', {"type":req.query.type, "source":req.query.source, "item":req.query.item, "userid":req.user?req.user.id:null, "email":req.user?req.user.emails[0].value:null,"reasons":common.reportReasons});
    }
};

exports.submit = function (req, res) {
    if (req.session.report.userid == '') {
        req.session.report.userid = req.user.id;
    }
    if (req.session.report.details == '') {
        req.session.report.details = null;
    }
    sqlConnection.query("INSERT INTO `report` (`type`, `source`, `item`, `highlevel`, `details`, `userid`) VALUES (?, ?, ?, ?, ?, ?)", [req.session.report.type.replace(/(<([^>]+)>)/ig,""), req.session.report.source.replace(/(<([^>]+)>)/ig,""), req.session.report.item.replace(/(<([^>]+)>)/ig,""), parseInt(req.session.report.highlevel), (req.session.report.details==null)?null:req.session.report.details.replace(/(<([^>]+)>)/ig,""), (req.session.report.userid==null)?null:parseInt(req.session.report.userid)], function (err, result) {
        if (err === null) {
            // Success
            // Send a message to alert the team about the report
            var email = new sendgrid.Email({
                "to": config.reportEmail,
                "from": req.user.emails[0].value,
                "subject": "Content Report",
                "text": "A new content report for " + req.session.report.type.replace(/(<([^>]+)>)/ig,"") + req.session.report.item.replace(/(<([^>]+)>)/ig,"") + " at " + req.session.report.source.replace(/(<([^>]+)>)/ig,"") + ".  The user reported this as '" + common.reportReasons[parseInt(req.session.report.highlevel)] + "'.\r\n\r\nThis report can be viewed at " + config.root + "/admin/report/item/" + result.insertId + ".\r\n\r\nRegards\r\n\r\nNouse Account Team"
            });
            sendgrid.send(email, function (err, json) {
                if (err) {
                    res.redirect(307, '/report/submit/email?error=1');
                }
            });
            // Display confirmation to the user
            res.render('report-sent');
            delete req.session.report;
        } else {
            // Error
            res.redirect(307, '/report/submit/email?error=1');
        }
    });
};

exports.submitPost = function (req, res, next) {
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
};

exports.email = function (req, res) {
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
};
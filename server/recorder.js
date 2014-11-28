/**
 * The module that manages recording the output of an instrument to the
 * database
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var PouchDB = require('pouchdb');
var dbs = require('./pouch-config');
 
var recording = false;
var logID = null; // recordingID is the ID of the log we are working with


exports.startRecording = function(id) {
    console.log("*** Start recording for session ID "  + id);
    logID = id;    
    recording = true;
    
    dbs.logs.get(logID, function(err,session) {
        if (err) {
            console.log("[recorder] Error finding log session. " + err);
        } else {
            session.startstamp = new Date().getTime();
            session.isrecording = true;
            dbs.logs.put(session, function(err, result) {
                if (err) console.log("[recorder] Error saving session startstamp. " + err);
            });
        }
    });    
};

exports.isRecording = function() {
    return recording;
}

exports.logID = function() {
    return logID;
}

exports.stopRecording = function() {
    console.log("*** Stop recording");
    recording = false;
    if (logID == null)
        return;

    dbs.logs.get(logID, function(err, session) {
        if (err) {
            console.log('Error updating log session entry: ' + err);
            res.send({'error':'An error has occurred'});
        } else {
            session.endstamp = new Date().getTime();
            session.isrecording = false;
            // TODO: update the number of points in 
            // the log object
            dbs.logs.put(session,function(err,session) {
                if (err)
                    console.log("Error saving log");
                logID = null;
            });
        }
    });
};
    

// Record is used for live recording only, so far.
// TODO: smarter way of recording is needed...
exports.record = function(data) {
    if (!recording || logID == null)
        return;

    console.log("*** Recording new entry in the log ***");
    var db = new PouchDB('./ldb/datapoints/' + logID);
    var entry = {
            timestamp: new Date().getTime(),
            data: data
    };
    console.log(entry);
    db.post(entry, function(err,entry) {
        if (err)
            console.log("Error saving entry: " + err);
    });
    
};
    



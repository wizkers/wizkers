/**
 * The module that manages recording the output of an instrument to the
 * database
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var mongoose = require('mongoose');
var DeviceLogEntry = mongoose.model('DeviceLogEntry');
var LogSession = mongoose.model('LogSession');
 
var recording = false;
var recordingID = null;


exports.startRecording = function(id) {
    console.log("*** Start recording for session ID "  + id);
    recordingID = id;    
    recording = true;
    
    LogSession.findById(recordingID, function(err,session) {
        if (err) {
            console.log("[recorder] Error finding log session. " + err);
        } else {
            session.startstamp = new Date().getTime();
            session.save(function(err) {
                if (err) console.log("[recorder] Error saving session startstamp. " + err);
            });
        }
    });
    
//    res.send({"recording": true});
};

exports.isRecording = function() {
    return recording;
}

exports.getRecordingID = function() {
    return recordingID;
}

exports.stopRecording = function() {
    console.log("*** Stop recording");
    recording = false;
    if (recordingID == null)
        return;

    LogSession.findById(recordingID, function(err, session) {
        if (err) {
            console.log('Error updating log session entry: ' + err);
            res.send({'error':'An error has occurred'});
        } else {
            session.endstamp = new Date().getTime();
            DeviceLogEntry.count({logsessionid: recordingID}, function(err,count) {
                if (err) {
                    console.log('Error updating log session entry: ' + err);
                    // res.send({'error': 'Error updating log session entry'});
                } else {
                    session.datapoints = count;
                    console.log("This log has " + count + " datapoints.");
                    session.save(function(err) {
                        if (err) console.log("[recorder] Error updating log session upon recording stop");
                    });
                }
            });
        }
    });
    // res.send({"recording": false});
};
    

// Record is used for live recording only, so far.
// TODO: smarter way of recording is needed...
exports.record = function(data) {
    if (!recording || recordingID == null)
        return;

    console.log("*** Recording new entry in the log ***");
    var entry = new DeviceLogEntry({
            logsessionid: recordingID,
            timestamp: new Date().getTime(),
            data: data
    });
    console.log(entry);
    entry.save(function(err,entry) {
        if (err)
            console.log("Error saving entry: " + err);
    });
    
};
    



/**
 * The module that manages recording the output of an instrument to the
 * database
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var PouchDB = require('pouchdb')
    dbs = require('./pouch-config'),
    microtime = require('./lib/microtime'),
    debug = require('debug')('wizkers:recorder');

var drivers = {};


//////////////
//  Private methods
//////////////

/**
 * Register a new instrument driver.
 */
var register = function(driver,logid, cb) {
    var instrumentid = driver.getInstrumentId();
    if (drivers.hasOwnProperty(instrumentid)) {
            debug('WARNING, this driver is already registered, this should not happen');
    } else {
        drivers[instrumentid] = { driver:driver, logid:logid, cb:cb };
    }
}


/**
 * The actual data recording function. Needs a reference to the data +
 * what log database it should record into.
 *
 * Record is used for live recording only so far.
 * TODO: smarter way of recording is needed...
 */
var record = function(data, logID) {

    // console.log("*** Recording new entry in the log ***");
    var db = new PouchDB('./ldb/datapoints/' + logID);
    debug("Log record in " + logID);
    debug(data);
    
    // We need microsecond precisions, because we can get
    // several recording calls within the same millisecond
    var ts = microtime.nowDouble();
    // Use the timestamp as the _id
    // we keep a "timestamp" entry for compatibility with
    // standalone front-end which uses indedxeddb for now, and has a separate
    // ID system.
    db.put({data: data, timestamp: ts}, '' + ts, function(err,entry) {
        if (err)
            debug("Error saving entry: " + err + " ID is: " + ts);
        // Keep the number of log entries up to date in the log DB
        /*
        db.info(function(err,res) {
            var c = res.doc_count;
            dbs.logs.get(logID, function(err,res2) {
                res2.datapoints = c;
                res2.endstamp = ts;
                dbs.logs.put(res2, function(err,res3) {});
            })
        });
        */
    });    
};

////////////////
// Public methods
////////////////

/**
 * Start recording. The Log database should already be created when we
 * get there.
 */
exports.startRecording = function(logid, driver) {
    var insid = driver.getInstrumentId();
    debug("*** Start recording log ID "  + logid + " for instrument " + insid);
    
    dbs.logs.get(logid, function(err,session) {
        if (err) {
            debug("[recorder] Error finding log session. " + err);
        } else {
            session.startstamp = new Date().getTime();
            session.isrecording = true;
            dbs.logs.put(session, function(err, result) {
                if (err) debug("[recorder] Error saving session startstamp. " + err);
            });
            // Now, register a callback on data events coming from the driver to
            // record the data:
            var cb = function(data) {
                record(data,logid);
            }
            register(driver,logid, cb); // Keep track for later use when we stop recording
            driver.on('data', cb);
        }
    });    
};

exports.isRecording = function(insid) {
    return drivers.hasOwnProperty(insid);
}

exports.logID = function() {
    debug("Asked to logID [deprecated]");
}

exports.stopRecording = function(insid) {
    if (! drivers.hasOwnProperty(insid)) {
        // We were asked to stop recording but we were not. That's OK
        return;
    }
    debug("Stop recording for instrument " + insid);
    var logID = drivers[insid].logid;
    var driver = drivers[insid].driver;
    dbs.logs.get(logID, function(err, session) {
        if (err) {
            console.log('Error updating log session entry: ' + err);
            res.send({'error':'An error has occurred'});
        } else {
            driver.removeListener('data', drivers[insid].cb);
            delete drivers[insid];
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
    
    



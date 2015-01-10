/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * The module that manages recording the output of an instrument to the
 * database
 * @author Edouard Lafargue, ed@lafargue.name
 */


var PouchDB = require('pouchdb')
dbs = require('./pouch-config'),
microtime = require('./lib/microtime'),
debug = require('debug')('wizkers:recorder');

var drivers = {};
var openlogs = {};

//////////////
//  Private methods
//////////////

/**
 * Register a new instrument driver.
 * @param {Object}   driver The driver object (reference)
 * @param {String}   logid  UniqueID of the log database
 * @param {Function} cb     Callback
 */
var register = function (driver, logid, cb, db) {
    var instrumentid = driver.getInstrumentId();
    if (drivers.hasOwnProperty(instrumentid)) {
        debug('WARNING, this driver is already registered, this should not happen');
    } else {
        drivers[instrumentid] = {
            driver: driver,
            logid: logid,
            cb: cb,
        };
        openlogs[logid] = db;
    }
}


/**
 * The actual data recording function. Needs a reference to the data +
 * what log database it should record into.
 *
 * Record is used for live recording only so far.
 * TODO: smarter way of recording is needed...
 */
var record = function (data, logID) {

    // console.log("*** Recording new entry in the log ***");
    if (openlogs[logID] === undefined) {
        debug("Error, trying to record but no open database");
        return;
    }
    var db = openlogs[logID];
    debug("Log record in " + logID);
    debug(data);

    // We need microsecond precisions, because we can get
    // several recording calls within the same millisecond
    var ts = microtime.nowDouble();
    // Use the timestamp as the _id
    // we keep a "timestamp" entry for compatibility with
    // standalone front-end which uses indedxeddb for now, and has a separate
    // ID system.
    db.put({
        data: data,
        timestamp: ts
    }, '' + ts, function (err, entry) {
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
exports.startRecording = function (logid, driver) {
    var insid = driver.getInstrumentId();
    debug("*** Start recording log ID " + logid + " for instrument " + insid);

    dbs.logs.get(logid, function (err, session) {
        if (err) {
            debug("[recorder] Error finding log session. " + err);
        } else {
            session.startstamp = new Date().getTime();
            session.isrecording = true;
            dbs.logs.put(session, function (err, result) {
                if (err) debug("[recorder] Error saving session startstamp. " + err);
            });
            // Now, register a callback on data events coming from the driver to
            // record the data:
            var cb = function (data) {
                record(data, logid);
            }
            var db = new PouchDB('./ldb/datapoints/' + logid);
            register(driver, logid, cb, db); // Keep track for later use when we stop recording
            driver.on('data', cb);
        }
    });
};

exports.isRecording = function (insid) {
    return drivers.hasOwnProperty(insid);
}

/**
 * Used by the "logs" router, to update the "recording" flag of all
 * logs before sending them to the front-end - we can have situations where the
 * app stopped/crashed, etc, and the recording flags are not consistent.
 *
 * Returns either -1 or the logID currently open for instrument ID "insid"
 */
exports.logID = function (insid) {
    if (drivers.hasOwnProperty(insid)) {
        return drivers[insid].logid;
    } else {
        return -1;
    }
}

exports.stopRecording = function (insid) {
    if (!drivers.hasOwnProperty(insid)) {
        // We were asked to stop recording but we were not. That's OK
        return;
    }
    debug("Stop recording for instrument " + insid);
    var logID = drivers[insid].logid;
    var driver = drivers[insid].driver;
    dbs.logs.get(logID, function (err, session) {
        if (err) {
            console.log('Error updating log session entry: ' + err);
            res.send({
                'error': 'An error has occurred'
            });
        } else {
            driver.removeListener('data', drivers[insid].cb);
            delete drivers[insid];
            delete openlogs[logID];
            session.endstamp = new Date().getTime();
            session.isrecording = false;
            // TODO: update the number of points in 
            // the log object
            dbs.logs.put(session, function (err, session) {
                if (err)
                    console.log("Error saving log");
                logID = null;
            });
        }
    });
};
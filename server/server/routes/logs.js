/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * REST API to store/retrieve/edit device logs.
 *
 *
 * @author Edouard Lafargue, edouard@lafargue.name
 *
 */

var PouchDB = require('pouchdb'),
    dbs = require('../pouch-config'),
    _ = require('underscore'),
    recorder = require('../recorder.js');

var debug = require('debug')('wizkers:routes:logs');


// Get all log sessions for a given instrument
exports.findByInstrumentId = function (req, res) {
    var id = req.params.id;
    debug('Retrieving Logs for Instrument ID: ' + id);

    dbs.logs.query('by_instrument', {
        key: id,
        include_docs: true
    }, function (err, items) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        var resp = [];
        if (items.rows && items.rows.length == 0) {
            res.send([]);
            return;
        }
        var sendResp = function () {
                res.send(resp);
            }
            // Query the number of data points and insert them into
            // the log (this avoids having to save the log document all the time
            // at each new recording and add tons of revisions on CouchDB).
        var af = _.after(items.rows.length, sendResp);
        _.each(items.rows, function (item) {
            // Double check there is a doc. In the extreme case something happened
            // at log creation where no keys were stored in the log, we can have an
            // empty entry (seen this in production).
            if (item.doc) {
                var db = dbs.createDataPointDB(item.doc._id);
                db.info(function (err, info) {
                    if (err) {
                        debug('Error retrieving datapoints', err);
                        return;
                    }
                    item.doc.datapoints = info.doc_count;
                    // A simple consistency check:
                    item.doc.isrecording = (item.doc._id == recorder.logID(id));
                    resp.push(item.doc);
                    af();
                });
            } else {
                af();
            }
        });
    });
};

// Get a log session
exports.findById = function (req, res) {
    var id = req.params.id;
    debug('Retrieving Log session ID: ' + id);
    dbs.logs.get(id, function (err, item) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        debug(item);
        res.send(item);
    });
};

exports.findAll = function (req, res) {
    dbs.logs.allDocs({
        include_docs: true
    }, function (err, items) {
        var resp = [];
        for (item in items.rows) {
            debug(item);
            resp.push(items.rows[item].doc);
        }
        debug(resp);
        res.send(resp);
    });
};

// Get all entries for a log session. These can be very large,
// so we have to stream the results back so that we don't get out
// of memory or let the client app hanging waiting for data
exports.getLogEntries = function (req, res) {
    var id = req.params.id;
    var count = 0;
    debug("Retrieving entries of log ID: " + id);
    var db = dbs.createDataPointDB(id);
    res.writeHead(200, {
        "Content-Type": "application/json"
    });
    res.write("[");
    var ok = false;
    // TODO: paginate those queries by 500 records to limit
    // memory usage
    db.allDocs({
        include_docs: true
    }, function (err, entries) {
        for (row in entries.rows) {
            var item = entries.rows[row];
            if (ok) res.write(",");
            ok = true;
            // Clean up the log data: we don't need a lot of stuff that takes
            // lots of space:
            // delete item._id;  // Don't delete the _id, otherwise our front-end loses sync with backend!            
            delete item.doc._rev;
            res.write(JSON.stringify(item.doc));
        }
        res.write(']');
        res.end();
    });

}

// Get log entries for the current live recording: we only get data for the last
// XX minutes
exports.getLive = function (req, res) {
    debug("Request to get extract of live recording for the last " + req.params.period + " minutes");
    var rid = recorder.logID(req.params.id);
    if (rid == -1) {
        res.send('{"error": "Not recording" }');
        return;
    }

    var minstamp = new Date().getTime() - req.params.period * 60000;
    debug(" Min Stamp: " + minstamp);
    var db = dbs.createDataPointDB(rid);
    res.writeHead(200, {
        "Content-Type": "application/json"
    });
    res.write("[");
    var ok = false;
    db.allDocs({
        startkey: minstamp,
        include_docs: true
    }, function (err, entries) {
        debug(entries);
        for (row in entries.rows) {
            var item = entries.rows[row];
            if (ok) res.write(",");
            ok = true;
            // Clean up the log data: we don't need a lot of stuff that takes
            // lots of space:
            delete item.doc._rev;
            delete item.doc._id;
            debug(item);
            res.write(JSON.stringify(item.doc));
        }
        res.write(']');
        res.end();
    });
}


/**
 * Add a new entry into an existing log
 * @param {Object}   req The HTTP Request object
 * @param {Function} res the callback
 * 
 * Note: the entry needs to contain a timestamp that is unique,
 * otherwise saving it will fail. The recorder uses a microsecond resolution,
 * most instruments use their own timestamps, the only requirement is that they
 * are unique.
 */
exports.addLogEntry = function (req, res) {
    var logID = req.params.id;
    var entry = req.body;
    delete entry._id;
    // Note: will create it if it does not exist
    var db = dbs.createDataPointDB(logID);
    debug(entry);
    db.put(entry, '' + entry.timestamp, function (err, entry) {
        if (err) {
            debug("Error saving entry: " + err + " ID is: " + entry.timestamp);
            res.send({
                'error': 'Error saving entry - ' + err
            });
        } else {
            res.send(entry);
        }
    });
}


// Add a new log into the database
exports.addLog = function (req, res) {
    var entry = req.body;
    var instrumentid = req.params.id;
    entry.instrumentid = instrumentid;
    debug('Create a new log for Instrument ID: ' + instrumentid + ' - ' + JSON.stringify(entry));
    dbs.logs.post(entry, function (err, result) {
        if (err) {
            res.send({
                'error': 'An error has occurred'
            });
        } else {
            debug('Success - result: ' + JSON.stringify(result));
            res.send({
                _id: result.id,
                _rev: result.rev
            });
        }
    });

};

// Update the contents of a log
exports.updateEntry = function (req, res) {
    var id = req.params.id;
    var iid = req.params.iid;
    var entry = req.body;
    debug('Updating log : ' + id + ' for instrument ' + iid);
    debug(JSON.stringify(entry));

    // TODO: error checking on structure !!!
    //  -> CouchDB validation
    dbs.logs.put(entry, function (err, result) {
        if (err) {
            debug('Error updating log session entry: ' + err);
            res.send({
                'error': 'An error has occurred'
            });
        } else {
            res.send({
                _id: result.id,
                _rev: result.rev
            });
        }
    });
};

// This deletes a LOG Entry
exports.deleteLogEntry = function (req, res) {
    var id = req.params.id;
    debug('Deleting log entry: ' + id);
    DeviceLogEntry.findByIdAndRemove(id, {
        safe: true
    }, function (err, result) {
        if (err) {
            res.send({
                'error': 'An error has occurred - ' + err
            });
        } else {
            debug('' + result + ' document(s) deleted');
            res.send(req.body);
        }
    });
}


// This deletes a log
exports.deleteLog = function (req, res) {
    var id = req.params.id;
    debug('Deleting log: ' + id);
    dbs.logs.get(id, function (err, log) {
        if (err) {
            debug('Error - ' + err);
            res.send({
                'error': 'An error has occurred - ' + err
            });
        } else {
            dbs.logs.remove(log, function (err, result) {
                if (err) {
                    debug('Error - ' + err);
                    res.send({
                        'error': 'An error has occurred - ' + err
                    });
                } else {
                    debug('' + result + ' document(s) deleted');
                    // Now delete the database of log points
                    PouchDB.destroy('./ldb/datapoints/' + id, function (err, res2) {
                        debug("Destroyed datapoints");
                        res.send(req.body);
                    });
                }
            });
        }
    });
}
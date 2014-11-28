/**
 * REST API to store/retrieve/edit device logs.
 *
 *
 * (c) 2013 Edouard Lafargue, edouard@lafargue.name
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var PouchDB = require('pouchdb');
var dbs = require('../pouch-config');
var recorder = require('../recorder.js');

// Get all log sessions for a given instrument
exports.findByInstrumentId = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving Logs for Instrument ID: ' + id);

    // TODO
    //  - Move to persistent queries (http://pouchdb.com/guides/queries.html)
    dbs.logs.query(function(doc) {
        emit(doc.instrumentid);
    }, {key: id, include_docs:true}, function(err,items) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        console.log(items);
        var resp = [];
        for (item in items.rows) {
            resp.push(items.rows[item].doc) ;
        }
        res.send(resp);
    });
};

// Get a log session
exports.findById = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving Log session ID: ' + id);
    dbs.logs.get(id, function(err,item) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        console.log(item);
        res.send(item);
    });
};

exports.findAll = function(req, res) {
    dbs.logs.allDocs({include_docs: true}, function(err, items) {
        var resp = [];
        for (item in items.rows) {
            console.log(item);
            resp.push(items.rows[item].doc) ;
        }
        console.log(resp);
        res.send(resp);
    });
};

// Get all entries for a log session. These can be very large,
// so we have to stream the results back so that we don't get out
// of memory or let the client app hanging waiting for data
exports.getLogEntries = function(req, res) {
    // Empty for now...
    var id = req.params.id;
    var count = 0;
    console.log("Retrieving entries of log ID: " + id);
    // TODO: Now, create a new database that will contain the data points for
    // this log with the format "datapoints/[log ID]"
    var db = new PouchDB('./ldb/datapoints/' + id);
    res.writeHead(200, {"Content-Type": "application/json"});
    res.write("[");
    var ok = false;
    db.allDocs({include_docs:true}, function(err,entries) {
        for (row in entries.rows) {
            var item = entries.rows[row];            
            if (ok) res.write(",");
            ok = true;
            // Clean up the log data: we don't need a lot of stuff that takes
            // lots of space:
            // delete item._id;  // Don't delete the _id, otherwise our front-end loses sync with backend!            
            console.log(item);
            delete item.doc._rev;
            res.write(JSON.stringify(item.doc));
        }
        res.write(']');
        res.end();
    });

}

// Get log entries for the current live recording: we only get data for the last
// XX minutes
exports.getLive = function(req,res) {
    console.log("Request to get extract of live recording for the last " + req.params.period + " minutes");
    var rid = recorder.logID();
    if (rid == null) {
        res.send('{"error": "Not recording" }');
        return;
    }
    
    // TODO : use a persistent view here!
    var map = function(doc) {
        emit (doc.timestamp);
    }
    
    var minstamp = new Date().getTime() - req.params.period* 60000;
    console.log(" Min Stamp: " + minstamp);
    var db = new PouchDB('./ldb/datapoints/' + rid);
    res.writeHead(200, {"Content-Type": "application/json"});
    res.write("[");
    var ok = false;
    db.query(map, {startkey: minstamp, include_docs:true}, function(err,entries) {
        console.log(entries);
        for (row in entries.rows) {
            var item = entries.rows[row];            
            if (ok) res.write(",");
            ok = true;
            // Clean up the log data: we don't need a lot of stuff that takes
            // lots of space:
            delete item.doc._rev;
            delete item.doc._id;
            console.log(item);
            res.write(JSON.stringify(item.doc));
        }
        res.write(']');
        res.end();    
    });
}


////////////////
//  This call is deprecated (log entries are created through the recorder now
////////////////
// Add a new log entry for a log:
// TODO : create a library to store logs in a more sophisticated
// manner - 1 hour granularity w/ 59 minute objects containing all measurements inside ? 
exports.addLogEntry = function(req, res) {
    var logID = req.params.id;
    var entry = req.body;
    delete entry._id;
    entry.logsessionid = logID;
    console.log(entry);
    new DeviceLogEntry(entry).save(function(err,entry) {
        if (err) {
            console.log("Error saving entry: " + err);
            res.send({'error': 'Error saving entry - ' + err});
        } else {
        res.send(entry);
        }
    });
}

// Add a new log session entry
exports.addLog = function(req, res) {
    var entry = req.body;
    var instrumentid = req.params.id;
    entry.instrumentid = instrumentid;
    console.log('Adding log entry for Instrument ID: ' + instrumentid + ' - ' + JSON.stringify(entry));
    dbs.logs.post(entry, function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                console.log('Success - result: ' + JSON.stringify(result));
                res.send({ _id: result.id, _rev: result.rev} );
            }
    });
    
};

// Update the contents of a log session
exports.updateEntry = function(req, res) {
    var id = req.params.id;
    var iid = req.params.iid;
    var entry = req.body;
    console.log('Updating log session entry: ' + id + ' for instrument ' + iid);
    console.log(JSON.stringify(entry));

    // TODO: error checking on structure !!!
    //  -> CouchDB validation
    dbs.logs.put(entry, function(err, result) {
                    if (err) {
                        console.log('Error updating log session entry: ' + err);
                        res.send({'error':'An error has occurred'});
                    } else {
                        res.send({ _id: result.id, _rev: result.rev} );
                    }
                }
                                );
};

// This deletes a LOG Entry
exports.deleteLogEntry = function(req, res) {
    var id = req.params.id;
    console.log('Deleting log entry: ' + id);
    DeviceLogEntry.findByIdAndRemove(id, {safe:true}, function(err,result) {
            if (err) {
                res.send({'error':'An error has occurred - ' + err});
            } else {
                console.log('' + result + ' document(s) deleted');
                res.send(req.body);
            }
    });    
}


// This deletes a log
exports.deleteLog= function(req, res) {
    var id = req.params.id;
    console.log('Deleting log: ' + id);
    dbs.logs.get(id, function(err,log) {
        if (err) {
            console.log('Error - ' + err);
            res.send({'error':'An error has occurred - ' + err});
        } else {
            dbs.logs.remove(log, function(err,result) {
                if (err) {
                    console.log('Error - ' + err);
                    res.send({'error':'An error has occurred - ' + err});
                } else {
                    console.log('' + result + ' document(s) deleted');
                    // Now delete the database of log points
                    PouchDB.destroy('./ldb/datapoints/' + id, function(err,res2) {
                        console.log("Destroyed datapoints");
                        res.send(req.body);
                    });
                }
            });
        }
    });
}

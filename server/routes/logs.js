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

var mongoose = require('mongoose');
var LogSession = mongoose.model('LogSession');
var DeviceLogEntry = mongoose.model('DeviceLogEntry');

// Get all log sessions for a given instrument
exports.findByInstrumentId = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving Logs for Instrument ID: ' + id);
    // Refresh number of datapoints for all logs. Won't fix the issue
    // immediately if logs are broken, but at next display. Hey, better than nothing,
    // this is a last resort attempt to fix records...
    LogSession.find({ instrumentid:id }, function(err,logstofix) {
        var fixEntries = function(log,index,array) {
            DeviceLogEntry.count({logsessionid: log.id}, function(err,count) {
                if (err) {
                    console.log('Error updating log session entry: ' + err);
                } else {
                    log.datapoints = count;
                    console.log("This log has " + count + " datapoints.");
                    log.save(function(err) {
                        if (err) console.log("[logs / findInstrumentByID] Error fixing datapoint count for logs");
                    });
                }
            });
        };
        logstofix.forEach(fixEntries);        
    });
    
    LogSession.find({ instrumentid: id} , function(err,item) {
        res.send(item);
    });
};

// Get a log session
exports.findById = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving Log session ID: ' + id);
    LogSession.findById(id, function(err,item) {
        res.send(item);
    });
}

// Get all entries for a log session. These can be very large,
// so we have to stream the results back so that we don't get out
// of memory or let the client app hanging waiting for data
exports.getLogEntries = function(req, res) {
    // Empty for now...
    var id = req.params.id;
    console.log("Retrieving entries of log ID: " + id);
    var stream = DeviceLogEntry.find({logsessionid: id}).stream();
    res.writeHead(200, {"Content-Type": "application/json"});
    res.write("[");
    var ok = false;
    stream.on('data', function(item) {
                         if (ok) res.write(",");
                         ok = true;
                         res.write(JSON.stringify(item));
                        }
             ).on('error', function(err) {
    }).on('close', function() {
        res.write("]");
        res.end();
    });
}

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

exports.findAll = function(req, res) {
    LogSession.find({}, function(err, items) {
        res.send(items);
    });
};

// Add a new log session entry
exports.addEntry = function(req, res) {
    var entry = req.body;
    delete entry._id;       // _id is sent from Backbone and is null, we
                            // don't want that
    var instrumentid = req.params.id;
    entry.instrumentid = instrumentid;
    console.log('Adding log entry for Instrument ID: ' + instrumentid + ' - ' + JSON.stringify(entry));
    new LogSession(entry).save( function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                console.log('Success - result: ' + JSON.stringify(result));
                res.send(result);
            }
    });
    
};

// Update the contents of a log session
exports.updateEntry = function(req, res) {
    var id = req.params.id;
    var iid = req.params.iid;
    var entry = req.body;
    delete entry._id;
    console.log('Updating log session entry: ' + id + ' for instrument ' + iid);
    console.log(JSON.stringify(entry));
    
    LogSession.findByIdAndUpdate(id, entry, {safe:true}, function(err, result) {
                    if (err) {
                        console.log('Error updating log session entry: ' + err);
                        res.send({'error':'An error has occurred'});
                    } else {
                        res.send(result);
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


// This deletes a LOG Session (i.e. a collection of log entries)
exports.deleteEntry = function(req, res) {
    var id = req.params.id;
    console.log('Deleting log session entry: ' + id);
    LogSession.findByIdAndRemove(id, {safe:true}, function(err,result) {
            if (err) {
                res.send({'error':'An error has occurred - ' + err});
            } else {
                console.log('' + result + ' document(s) deleted');
                // Now, delete every entry that was linked to this log
                // TODO: no error handling, not that we really should need it?
                DeviceLogEntry.find({logsessionid: id}, function(err,items) {
                        items.forEach(function(item) {
                            item.remove();
                        });
                        });
                res.send(req.body);
            }
    });    
}

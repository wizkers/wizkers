/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * REST API to store/retrieve/edit device output plugins.
 *
 *
 * @author Edouard Lafargue, edouard@lafargue.name
 *
 */

var dbs = require('../pouch-config');
var debug = require('debug')('wizkers:routes:outputs');


// Get all outputs for a given instrument
exports.findByInstrumentId = function(req, res) {
    var id = req.params.id;
    debug('Retrieving Outputs for Instrument ID: ' + id);

    // TODO
    //  - Move to persistent queries (http://pouchdb.com/guides/queries.html)
    dbs.outputs.query(function(doc) {
        emit(doc.instrumentid);
    }, {key: id, include_docs:true}, function(err,items) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        var resp = [];
        for (item in items.rows) {
            resp.push(items.rows[item].doc) ;
        }
        res.send(resp);
    });
};

// Get a specific output
exports.findById = function(req, res) {
    var id = req.params.id;
    debug('Retrieving output: ' + id);
    dbs.outputs.get(id, function(err,item) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        res.send(item);
    });
};


// Create a new output
exports.addOutput = function(req, res) {
    var output = req.body;
    debug('Adding output: ' + JSON.stringify(output));
    dbs.outputs.post(output, function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                res.send({ _id: result.id, _rev: result.rev} );
            }
    });
};

// Update an existing output
// The server updates outputs regularly to keep the latest result,
// so we will run into revision ID issues with PouchDB/CouchDB. For this
// reason, we get/put rather than just put:
exports.updateOutput = function(req, res) {
    var id = req.params.id;
    var output = req.body;
    debug('Updating output: ' + id);
    dbs.outputs.get(id, function(err,old_output) {
        if (err) {
            debug('Error - ' + err);
            res.send({'error':'An error has occurred - ' + err});
        } else {
            // Preserve revision and also success data:
            output._rev = old_output._rev;
            output.last = old_output.last;
            output.lastmessage = old_output.lastmessage;
            output.lastsuccess = old_output.lastsuccess;
            dbs.outputs.put(req.body, function(err, result) {
                    if (err) {
                        debug('Error updating output: ' + err);
                        res.send({'error':'An error has occurred'});
                    } else {
                        res.send({ _id: result.id, _rev: result.rev} );
                    }
            });
        }
    });
}

exports.deleteOutput = function(req, res) {
    var id = req.params.id;
    debug('Deleting output: ' + id);
    dbs.outputs.get(id, function(err,ins) {
        if (err) {
            debug('Error - ' + err);
            res.send({'error':'An error has occurred - ' + err});
        } else {
            dbs.outputs.remove(ins, function(err,result) {
                if (err) {
                    debug('Error - ' + err);
                    res.send({'error':'An error has occurred - ' + err});
                } else {
                    res.send(req.body);
                }
            });
        }
    });
}
/**
 * REST API to store/retrieve/edit device output plugins.
 *
 *
 * (c) 2014 Edouard Lafargue, edouard@lafargue.name
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
exports.updateOutput = function(req, res) {
    var id = req.params.id;
    var output = req.body;
    debug('Updating output: ' + id);
//    debug(JSON.stringify(output));    
    dbs.outputs.put(req.body, function(err, result) {
            if (err) {
                debug('Error updating output: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                res.send({ _id: result.id, _rev: result.rev} );
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
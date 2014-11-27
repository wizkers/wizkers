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

// Get all outputs for a given instrument
exports.findByInstrumentId = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving Outputs for Instrument ID: ' + id);
    
    // TODO
    //  - Move to persistent queries (http://pouchdb.com/guides/queries.html)
    //  - Update entries count in the log (views ??)
    dbs.outputs.query(function(doc) {
        emit(doc.instrumentid);
    }, {key: id, include_docs:true}, function(err,items) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        console.log(items);
        var resp = [];
        for (item in items.rows) {
            console.log(item);
            resp.push(items.rows[item].doc) ;
        }
        res.send(resp);
    });
};

// Get a specific output
exports.findById = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving output: ' + id);
    dbs.outputs.get(id, function(err,item) {
        if (err && err.status == 404) {
            res.send([]);
            return;
        }
        console.log(item);
        res.send(item);
    });
};


// Create a new output
exports.addOutput = function(req, res) {
    var output = req.body;
    console.log('Adding output: ' + JSON.stringify(output));
    dbs.outputs.post(output, function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                console.log('Success: ' + JSON.stringify(result));
                res.send(result);
            }
    });    
};

// Update an existing output
exports.updateOutput = function(req, res) {
    var id = req.params.id;
    var output = req.body;
    console.log('Updating output: ' + id);
    console.log(JSON.stringify(output));    
    dbs.outputs.put(req.body, function(err, result) {
            if (err) {
                console.log('Error updating output: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                console.log('' + result + ' document(s) updated');
                res.send(result);
            }
    });
}

exports.deleteOutput = function(req, res) {
    var id = req.params.id;
    console.log('Deleting output: ' + id);
    dbs.outputs.get(id, function(err,ins) {
        if (err) {
            console.log('Error - ' + err);
            res.send({'error':'An error has occurred - ' + err});
        } else {
            dbs.outputs.remove(ins, function(err,result) {
                if (err) {
                    console.log('Error - ' + err);
                    res.send({'error':'An error has occurred - ' + err});
                } else {
                    console.log('' + result + ' document(s) deleted');
                    res.send(req.body);
                }
            });
        }
    });

}


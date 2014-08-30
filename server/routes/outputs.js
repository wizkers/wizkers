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

var mongoose = require('mongoose');
var Output = mongoose.model('Output');

// Get all outputs for a given instrument
exports.findByInstrumentId = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving Outputs for Instrument ID: ' + id);
    Output.find({ instrumentid: id} , function(err,items) {
        res.send(items);
    });
};

// Get a specific output
exports.findById = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving output: ' + id);
    Output.findById(id, function(err,item) {
        res.send(item);
    });
};


// Create a new output
exports.addOutput = function(req, res) {
    var output = req.body;
    console.log('Adding output: ' + JSON.stringify(output));
    new Output(output).save( function(err, result) {
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
    console.log(JSON.stringify(output));
    delete output._id;
    console.log('Updating output: ' + id);
    console.log(JSON.stringify(output));
    Output.findByIdAndUpdate(id, output, {safe:true}, function(err, result) {
            if (err) {
                console.log('Error updating output: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                console.log('' + result + ' output was updated');
                res.send(result);
            }
    });    
}

exports.deleteOutput = function(req, res) {
    var id = req.params.id;
    console.log('Deleting output: ' + id);
    Output.findByIdAndRemove(id, {safe:true}, function(err,result) {
            if (err) {
                res.send({'error':'An error has occurred - ' + err});
            } else {
                console.log('' + result + ' output deleted');
                res.send(req.body);
            }
    });    
}


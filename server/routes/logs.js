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

exports.findByInstrumentId = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving Log session entries for Instrument ID: ' + id);
    LogSession.find({ instrumentid: id} , function(err,item) {
        res.send(item);
    });
};

exports.findAll = function(req, res) {
    LogSession.find({}, function(err, items) {
        res.send(items);
    });
};

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
                console.log('' + result + ' document(s) updated');
                res.send(entry);
            }
    });    
}


exports.deleteEntry = function(req, res) {
    var id = req.params.id;
    console.log('Deleting log session entry: ' + id);
    LogSession.findByIdAndRemove(id, {safe:true}, function(err,result) {
            if (err) {
                res.send({'error':'An error has occurred - ' + err});
            } else {
                console.log('' + result + ' document(s) deleted');
                res.send(req.body);
            }
    });    
}

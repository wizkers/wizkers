/**
 * REST API to talk to accessories.
 *
 * The REST API lets us:
 * - Edit configuration parameters
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
var Accessory = mongoose.model('Accessory');

exports.findById = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving accessory: ' + id);
    Accessory.findById(id, function(err,item) {
        res.send(item);
    });
};

exports.findAll = function(req, res) {
    Accessory.find({}, function(err, items) {
        res.send(items);
    });
};

exports.addAccessory = function(req, res) {
    var accessory = req.body;
    delete accessory._id;  // _id is sent from Backbone and is null, we
                            // don't want that
    console.log('Adding accessory: ' + JSON.stringify(accessory));
    new Accessory(accessory).save( function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                console.log('Success - result: ' + JSON.stringify(result));
                res.send(result);
            }
    });
    
};

exports.updateAccessory = function(req, res) {
    var id = req.params.id;
    var accessory = req.body;
    delete accessory._id;
    console.log('Updating accessory: ' + id);
    console.log(JSON.stringify(accessory));
    Accessory.findByIdAndUpdate(id, accessory, {safe:true}, function(err, result) {
            if (err) {
                console.log('Error updating accessory: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                console.log('' + result + ' document(s) updated');
                res.send(accessory);
            }
    });    
}


exports.deleteAccessory = function(req, res) {
    var id = req.params.id;
    console.log('Deleting accessory: ' + id);
    Accessory.findByIdAndRemove(id, {safe:true}, function(err,result) {
            if (err) {
                res.send({'error':'An error has occurred - ' + err});
            } else {
                console.log('' + result + ' document(s) deleted');
                res.send(req.body);
            }
    });    
}

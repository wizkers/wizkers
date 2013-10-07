/**
 * REST API to manage cars.
 *
 * A car contains:
 * - Name
 * - Reference
 * - Picture
 * - Notes
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
var Car = mongoose.model('Car');
var fs = require('fs');


exports.findById = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving car: ' + id);
    Car.findById(id, function(err,item) {
        res.send(item);
    });
};

exports.findAll = function(req, res) {
    Car.find({}, function(err, items) {
        res.send(items);
    });
};

exports.addCar = function(req, res) {
    var car = req.body;
    console.log('Adding car: ' + JSON.stringify(car));
    new Car(car).save( function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                console.log('Success: ' + JSON.stringify(result));
                res.send(result);
            }
    });
    
};

exports.updateCar = function(req, res) {
    var id = req.params.id;
    var car = req.body;
    delete car._id;
    console.log('Updating car: ' + id);
    console.log(JSON.stringify(car));
    Car.findByIdAndUpdate(id, car, {safe:true}, function(err, result) {
            if (err) {
                console.log('Error updating car: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                console.log('' + result + ' document(s) updated');
                res.send(car);
            }
    });    
}

exports.deleteCar = function(req, res) {
    var id = req.params.id;
    console.log('Deleting car: ' + id);
    Car.findByIdAndRemove(id, {safe:true}, function(err,result) {
            if (err) {
                res.send({'error':'An error has occurred - ' + err});
            } else {
                console.log('' + result + ' document(s) deleted');
                res.send(req.body);
            }
    });    
}
    
exports.uploadPic = function(req,res) {
    var id= req.params.id;
    if (req.files) {
        console.log('Will save picture ' + JSON.stringify(req.files) + ' for Car ID: ' + id);
        // We use an 'upload' dir on our server to ensure we're on the same FS
        var filenameExt = req.files.file.path.split(".").pop();
        console.log('Debug: ' + './public/pics/cars/' + id + '.' + filenameExt);
        // Note: we reference the target filename relative to the path where the server
        // was started:
        fs.rename(req.files.file.path, './public/pics/cars/' + id + '.' + filenameExt,
                 function(err) {
                    if (err) {
                        fs.unlinkSync(req.files.file.path);
                        console.log('Error saving file, deleted temporary upload');                        
                    } else
                        res.send(true);
                 }
        );
    } else {
        res.send(false);
    }
}
/**
 * REST API to manage Instruments.
 *
 * An instrument contains:
 * - Name
 * - Notes
 * - Device type (-> choice of instrument parser)
 * - Port index/name
 * - Instrument-specific options
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


var dbs = require('../pouch-config');
var fs = require('fs');


exports.findById = function(req, res) {
    var id = req.params.id;
    console.log('Retrieving instrument: ' + id);
    dbs.instruments.get(id, function(err,item) {
        res.send(item);
    });
};

exports.findAll = function(req, res) {
    dbs.instruments.allDocs({include_docs: true}, function(err, items) {
        var resp = [];
        for (item in items.rows) {
            console.log(item);
            resp.push(items.rows[item].doc) ;
        }
        console.log(resp);
        res.send(resp);
    });
};

exports.addInstrument = function(req, res) {
    var instrument = req.body;
    console.log(instrument);
    console.log('Adding instrument: ' + JSON.stringify(instrument));
    dbs.instruments.post(req.body, function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                console.log('Success: ' + JSON.stringify(result));
                res.send(result);
            }
    });    
};

exports.updateInstrument = function(req, res) {
    var id = req.params.id;
    var instrument = req.body;
    console.log('Updating instrument: ' + id);
    console.log(JSON.stringify(instrument));
    dbs.instruments.put(req.body, function(err, result) {
            if (err) {
                console.log('Error updating instrument: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                console.log('' + result + ' document(s) updated');
                res.send(instrument);
            }
    });    
}

exports.deleteInstrument = function(req, res) {
    var id = req.params.id;
    console.log('Deleting instrument: ' + id);
    dbs.instruments.get(id, function(err,ins) {
        if (err) {
            console.log('Error - ' + err);
            res.send({'error':'An error has occurred - ' + err});
        } else {
            dbs.instruments.remove(ins, function(err,result) {
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
    
exports.uploadPic = function(req,res) {
    var id= req.params.id;
    if (req.files) {
        console.log('Will save picture ' + JSON.stringify(req.files) + ' for Instrument ID: ' + id);
        // We use an 'upload' dir on our server to ensure we're on the same FS
        var filenameExt = req.files.file.path.split(".").pop();
        console.log('Debug: ' + './public/pics/instruments/' + id + '.' + filenameExt);
        // Note: we reference the target filename relative to the path where the server
        // was started. One trick though: we can be in a situation where we are on two different
        // filesystems (who know?) and fs.rename won't work and return a "EXDEV" error. For this
        // reason, we are using a more involved operation based on pipes.
        var inputFile = fs.createReadStream(req.files.file.path);
        var outputFile = fs.createWriteStream('./public/pics/instruments/' + id + '.' + filenameExt);
        try { inputFile.pipe(outputFile);
        inputFile.on('end', function() {
                        fs.unlinkSync(req.files.file.path);
                        res.send(true);
                    });
            } catch (err) {
                        fs.unlinkSync(req.files.file.path);
                        console.log('Error saving file, deleted temporary upload - ' + err);                        
        };
    } else {
        res.send(false);
    }
}
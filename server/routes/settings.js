/**
 * REST API to manage our settings. A simple get/set.
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

exports.getSettings = function(req, res) {
    // Note: 'coresettings' always exists since it is created/
    // refreshed at application startup.
    dbs.settings.get('coresettings', function(err, item) {
        item.currentUserRole = req.user.role;
        res.send(item);
    });
};

exports.updateSettings = function(req, res) {
    var settings = req.body;
    //delete settings._id;
    console.log('Updating settings.');
    console.log(JSON.stringify(settings));
    dbs.settings.put(settings,function(err, result) {
            if (err) {
                console.log('Error updating settings: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                console.log('' + result + ' document(s) updated');
                res.send(settings);
            }
    });    
}

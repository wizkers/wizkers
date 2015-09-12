/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * REST API to manage our settings. A simple get/set.
 *
 * @author Edouard Lafargue, edouard@lafargue.name
 *
 */


var dbs = require('../pouch-config');
var debug = require('debug')('wizkers:routes:settings');

/**
 * Get the settings for a given user
 * @param {Object}   req Request object containing a 'user' property
 * @param {Function} res result handle
 */
exports.getSettings = function(req, res) {
    // Note: 'coresettings' always exists since it is created/
    // refreshed at application startup.
    debug('getSettings', req.user);
    dbs.settings.get(req.user.local.email, function(err, item) {
        if (err) {
            debug('getSettings - requested settings for an unknown user');
            item = dbs.defaults.settings;
            res.send("500: bad request");
            return;
        }
        // Note: currentUserRole is purely used by the front-end to
        // determine what options should be available. It is not used to
        // enforce any server-side security role, which would be terribly insecure.
        // In case a user tries to hack the value, they will simply end up with
        // user interface options which do not work when they try to use them.
        item.currentUserRole = req.user.role;
        res.send(item);
    });
};

exports.updateSettings = function(req, res) {
    var settings = req.body;
    debug('Updating settings.');
    dbs.settings.put(settings,function(err, result) {
            if (err) {
                debug('Error updating settings: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
                res.send({ _id: result.id, _rev: result.rev});
            }
    });    
}

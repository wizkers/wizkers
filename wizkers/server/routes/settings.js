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

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
 * This module connects the application to a backend analytics service.
 * By default, it is Google Analytics. No personal info is gathered, only
 * technical elements.
 *
 * At a later stage, this could be extended to support asset tracking as a
 * separate service.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function (require) {

    "use strict";

    var Backbone = require('backbone');


    var stats = function () {

        //////
        // Private variables
        //////

        var tracking_id = 'UA-XXXXX-XX',
            service = undefined,
            config = undefined,
            instrumenttype = '',
            tracker = undefined;

        // Define a wrapper for most GA functions, so that we
        // can call them using a unified API even when GA is not
        // connected.


        /////
        // Public
        /////

        this.init = function (gatag) {
            // You'll usually only ever have to create one service instance.
            service = analytics.getService('Wizkers');
            service.getConfig().addCallback(initConfig);

            // You can create as many trackers as you want. Each tracker has its own state
            // independent of other tracker instances.
            tracker = service.getTracker(gatag); // Supply your GA Tracking ID.
        };

        this.sendAppView = function (description) {
            if (tracker)
                tracker.sendAppView(description);
        }
        
        this.setTrackingEnabled = function(en) {
            if (config) {
                config.setTrackingPermitted(en);
            }
        }
        
        this.getService = function() {
            return service;
        }
        
        // Custom events related to actions on instruments (not
        // app-level actions)
        this.instrumentEvent = function(action, label) {
            if (!tracker)
                return;
            // category / action / label
            tracker.sendEvent('Instrument', action, label);
        }
        
        
        
        this.setInstrumentType = function (instype) {
            if (tracker) {
                var dimensionValue = 'instrument type';
                tracker.set('dimension1', instype);
            }
        }
        
        //////
        // Private
        //////
        var initConfig = function(c) {
            config = c;
        }

    }

    return stats;

});
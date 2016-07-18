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
 * This module connects the application to a backend analytics service.
 * By default, it is Google Analytics. No personal info is gathered, only
 * technical elements.
 *
 * At a later stage, this could be extended to support asset tracking as a
 * separate service.
 *
 * This is the Cordova version (using the cordova-google-analytics plugin)
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

            tracker = window.analytics.startTrackerWithId(gatag); // Supply your GA Tracking ID.
        };

        this.sendAppView = function (description) {
            window.analytics.trackView(description);
        }

        this.setTrackingEnabled = function (en) {
            if (config) {
                config.setTrackingPermitted(en);
            }
        }

        this.getService = function () {
            return service;
        }

        // Custom events related to actions on instruments (not
        // app-level actions)
        this.instrumentEvent = function (action, label) {
            // category / action / label
            // window.analytics.trackEvent('Category', 'Action', 'Label', Value)
            window.analytics.trackEvent('Instrument', action, label);
        }

        this.fullEvent = function (category, action, label) {
            // category / action / label
            window.analytics.trackEvent(category, action, label);
        }

        this.setInstrumentType = function (instype) {
            window.analytics.addCustomDimension('dimension1', instype);
        }

        //////
        // Private
        //////
        var initConfig = function (c) {
            config = c;
        }

    }

    return stats;

});
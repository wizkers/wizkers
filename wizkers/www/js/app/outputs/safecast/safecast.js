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
 *
 * Send data to the Safecast API
 *
 * This plugin shall implement the following API
 *
 *  - wantOnly() : either an empty array, or string array of data types the plugin accepts
 *  - outputFields(): returns a list of all data fields the plugin wants/requires/supports
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {

    "use strict";

    var Safecast = {

        wantOnly: function() {
            return [ "radioactivity" ];
        },

        requestAllData: function() {
            return false;
        },

        outputFields: function() {
            return { "radiation": { "name": "Radiation Level", "required": true },
                     "unit"     : { "name": "Unit", "required": true},
                     "latitude" : { "name": "Latitude", "required": true },
                     "longitude": { "name": "Longitude", "required": true },
                     "height"   : { "name": "Height", "required": false},
                     "device_id": { "name": "Device Id", "required": false },
                    // Those Xtra fields can be used by the output system to create alarms,
                    // but they are not forwarded to Safecast
                     "xtra_1"   : { "name": "Extra field 1", "required": false },
                     "xtra_2"   : { "name": "Extra field 2", "required": false }
                   }
        }
    };

    return Safecast;

});
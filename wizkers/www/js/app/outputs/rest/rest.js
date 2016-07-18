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
 * Send data through RESTful calls
 *
 * This plugin shall implement the following API
 *
 *  - wantOnly() : either an empty array, or string array of data types the plugin accepts
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {

    "use strict";

    var Rest = {

        wantOnly: function() {
            return [];
        },

        requestAllData: function() {
            return false;
        },

        // We do not enforce a strict number of fields.
        outputFields: function() {
            return "variable";
            /*
            return { "field1": { "name": "Field 1", "required": true },
                     "field2" : { "name": "Field 2", "required": false},
                     "field3" : { "name": "Field 3", "required": false },
                     "field4" : { "name": "Field 4", "required": false },
                     "field5" : { "name": "Field 5", "required": false },
                     "field6" : { "name": "Field 6", "required": false },
                   }
             */
        }
    };

    return Rest;

});
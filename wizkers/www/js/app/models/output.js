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
 * "Outputs"
 *
 * Holds the settings of the various output plugins that are enabled
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {

    "use strict";

    var $   = require('jquery'),
        Backbone = require('backbone');

    var Output = Backbone.Model.extend({

            type: null,
            idAttribute: "_id",

            initialize: function () {
                this.validators = {};
                this.validators.name = function (value) {
                    return value.length > 0 ? {isValid: true} : {isValid: false, message: "You must enter a name"};
                };

            },

            defaults: {
                instrumentid: 0,                // Instrument for this log (not the instrument's serial number, but the ID in MongoDB)
                name: "REST call",                 // Used for display
                type: "rest",                      // The output type to know what output plugin to load
                comment: "enter your notes here",  // Simple comments
                enabled: false,                    // Whether the plugin is active
                mappings: {},                    // Data fields we want to send
                metadata: {},                      // Freeform metadata
                wantsalldata: false,              // Output requests all data (overrides alarm and frequency settings)
                alarm1: { field: "", comparator: "moreeq", level: 0 },
                alarm2: { field: "", comparator: "less", level: 100 },
                alrmbool: "or",
                frequency: 0,       // Output frequency under normal conditions
                alrmfrequency: 0,  // Output frequency when in alarm condition
                lastsuccess: 0,  // When data was last sent with success
                last: 0,         // When data was last sent
                lastmessage: "", // Reply or error when data was last sent

            }
        }),

        Outputs = Backbone.Collection.extend({

            model: Output,

            initialize: function() {
            }

        });

    return {
        Output: Output,
        Outputs: Outputs
    };
});

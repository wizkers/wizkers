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
 * Where we define the settings. Note that we always use the
 * localstorage mechanism to store settings locally.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {

    "use strict";

    var $   = require('jquery'),
        Backbone = require('backbone');

    return Backbone.Model.extend({

        initialize: function () {
            if (vizapp.type == "chrome" || vizapp.type == 'nwjs') {
                this.chromeStorage =  new Backbone.ChromeStorage("org.aerodynes.vizapp.Settings");
            } else if (vizapp.type == "cordova") {
                this.localStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Settings");
            } else {
                this.url = "/settings";
            }
        },

        defaults: {
            serialPort: null,
            timezone: "browser",
            cpmcolor: 0,
            cpmscale: "linear",
            itemsperpage: 10,
            currentInstrument: null,
            token: null,
            showstream: false,
            enablestats: true,
        }
    });

});

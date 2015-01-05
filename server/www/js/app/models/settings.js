/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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
            if (vizapp.type == "chrome") {
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
        }
    });    
    
});

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
/*
 * Display output of Geiger counter in numeric format
 * 
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        template = require('js/tpl/instruments/sark110/Sark110NumView.js');

    return Backbone.View.extend({

        initialize:function (options) {
            linkManager.on('input', this.showInput, this);
        },

        events: {
            "click #cmd_sweep": "freq_sweep",
        },

        render:function () {
            var self = this;
            console.log('Main render of Sark110 numeric view');
            $(this.el).html(template());
            return this;
        },
        
        freq_sweep: function() {
            var min = parseInt($('#startfreq', this.el).val());
            var max = parseInt($('#endfreq', this.el).val());
            var step = (max-min)/256;
            
            // Reset the plot:
            instrumentManager.liveViewRef().plot.clearData();
            
            for (var i = min; i < max ; i += step) {
                linkManager.driver.rx(i);
            }
            linkManager.driver.version();
        },

        onClose: function() {
            console.log("Sark110 numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function(data) {
        },


    });
});
/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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
        template = require('js/tpl/instruments/HawkNestNumView.js');


    var probeid = '-';
    var readings = {};
    
    return Backbone.View.extend({

        initialize:function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.valid = false;
            this.validinit = false;
            
            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render:function () {
            var self = this;
            $(this.el).html(template());
            if (probeid != '-') {
                var pname = instrumentManager.getInstrument().get('metadata').probes[probeid].name || probeid;
                $("#probeid",this.el).html(pname);
                if (readings[probeid] != undefined) {
                    $('#livecpm', this.el).html(readings[probeid].cpm);
                    $('#livecpm2', this.el).html(readings[probeid].cpm2);
                }
            }
            return this;
        },

        onClose: function() {
            console.log("Hawk Nest numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },
        
        selectProbe: function(pid) {
            probeid = pid;
            this.render();
        },

        showInput: function(data) {
            
            if (typeof(data.cpm) == 'undefined')
                return;
            
            var cpm = parseFloat(data.cpm.value).toFixed(3);
            var cpm2 = parseFloat(data.cpm2.value).toFixed(3);
            readings[data.probeid] = { cpm: cpm, cpm2: cpm2};

            if (data.probeid != probeid)
                return;
            
            $('#livecpm', this.el).html(cpm);
            $('#livecpm2', this.el).html(cpm2);
            
        },


    });
});